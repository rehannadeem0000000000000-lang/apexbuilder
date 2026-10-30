import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { db } from "@/db";
import { projects } from "@/db/schema";
import {
  GithubError,
  ghDownloadArtifactFile,
  ghListArtifacts,
  loadGithubSettings,
} from "@/lib/github";

const ARTIFACT_DIR = join(process.cwd(), "data", "artifacts");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!rows.length) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const row = rows[0];
  const ext = row.platform === "aab" ? "aab" : "apk";
  const slug = row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "apex-app";
  const fileName = `${slug}-release.${ext}`;
  const localPath = join(ARTIFACT_DIR, `${id}.${ext}`);

  if (existsSync(localPath)) {
    const buf = await import("fs").then((fs) => fs.readFileSync(localPath));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": ext === "aab" ? "application/octet-stream" : "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const s = await loadGithubSettings();
  if (!s.token || !row.githubRunId) {
    return NextResponse.json({ error: "Build is not ready yet" }, { status: 409 });
  }
  try {
    let artifactId = row.githubArtifactId ? Number(row.githubArtifactId) : null;
    if (!artifactId) {
      const artifacts = await ghListArtifacts(s, Number(row.githubRunId));
      const match = artifacts.find((a) => a.name.includes(id)) ?? artifacts[0];
      if (!match) return NextResponse.json({ error: "No artifact found on this run" }, { status: 409 });
      artifactId = match.id;
      await db
        .update(projects)
        .set({ githubArtifactId: String(match.id), githubArtifactName: match.name })
        .where(eq(projects.id, id));
    }
    const buf = await ghDownloadArtifactFile(s, artifactId, ext);
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(localPath, buf);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": ext === "aab" ? "application/octet-stream" : "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof GithubError ? e.message : e instanceof Error ? e.message : "Download failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
