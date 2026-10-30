import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { GithubError, ghFindRunAfter, ghJobLogs, loadGithubSettings } from "@/lib/github";

const MAX_TAIL_LINES = 400;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!rows.length) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const row = rows[0];
  if (!row.githubRunId && !row.startedAt) {
    return NextResponse.json({ lines: ["Build not started yet."], complete: true });
  }

  const s = await loadGithubSettings();
  try {
    let runId = row.githubRunId ? Number(row.githubRunId) : null;
    if (!runId) {
      const run = await ghFindRunAfter(s, s.workflow, (row.startedAt ?? row.createdAt).toISOString());
      runId = run?.id ?? null;
      if (runId) await db.update(projects).set({ githubRunId: String(runId) }).where(eq(projects.id, id));
    }
    if (!runId) return NextResponse.json({ lines: ["Waiting for the GitHub Actions run to be created…"], complete: false });

    const { text, complete } = await ghJobLogs(s, runId);
    const all = text.split("\n").filter((l) => l.length > 0 || true);
    const lines = all.slice(-MAX_TAIL_LINES);
    return NextResponse.json({ lines, complete, truncated: all.length > MAX_TAIL_LINES, totalLines: all.length });
  } catch (e) {
    const msg = e instanceof GithubError ? e.message : e instanceof Error ? e.message : "Log fetch failed";
    return NextResponse.json({ lines: [msg], complete: false });
  }
}
