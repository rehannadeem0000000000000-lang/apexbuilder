import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { db } from "@/db";
import { projects } from "@/db/schema";
import {
  GithubError,
  ghDefaultBranch,
  ghDispatch,
  ghUploadFile,
  loadGithubSettings,
} from "@/lib/github";

/**
 * Pushes the project source + config.json to the GitHub farm repo, then
 * triggers the build-apk.yml workflow via workflow_dispatch.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!rows.length) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const row = rows[0];

  const s = await loadGithubSettings();
  if (!s.token || !s.owner || !s.repo) {
    return NextResponse.json(
      { error: "GitHub is not connected. Add your token, owner and farm repo in Settings." },
      { status: 400 },
    );
  }

  try {
    const branch = await ghDefaultBranch(s);
    const base = `projects/${id}`;

    if (row.sourceType === "upload" && row.filePath) {
      const buf = readFileSync(row.filePath);
      const target = row.fileType === "zip" ? `${base}/project.zip` : `${base}/index.html`;
      await ghUploadFile(s, branch, target, buf.toString("base64"), `source for ${row.name}`);
    }

    const configPayload = {
      ...row.config,
      project: id,
      sourceType: row.sourceType,
      fileType: row.fileType,
      platform: row.platform,
      appName: row.name,
      appId: `com.${row.config.packageSuffix}`,
    };
    await ghUploadFile(
      s,
      branch,
      `${base}/config.json`,
      Buffer.from(JSON.stringify(configPayload, null, 2)).toString("base64"),
      `config for ${row.name}`,
    );

    await ghDispatch(s, branch, s.workflow, { project: id, platform: row.platform });

    const now = new Date();
    await db
      .update(projects)
      .set({ status: "building", startedAt: now, updatedAt: now, error: null, githubRunId: null, githubArtifactId: null })
      .where(eq(projects.id, id));

    return NextResponse.json({ ok: true, branch });
  } catch (e) {
    const msg = e instanceof GithubError ? e.message : e instanceof Error ? e.message : "Dispatch failed";
    await db.update(projects).set({ status: "failed", error: msg, updatedAt: new Date() }).where(eq(projects.id, id));
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
