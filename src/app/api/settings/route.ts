import { NextRequest, NextResponse } from "next/server";
import { GithubError, ghWhoami, loadGithubSettings, saveGithubSettings } from "@/lib/github";

export async function GET() {
  const s = await loadGithubSettings();
  const token = s.token ?? "";
  return NextResponse.json({
    connected: Boolean(token && s.owner && s.repo),
    tokenLast4: token ? token.slice(-4) : null,
    hasToken: Boolean(token),
    owner: s.owner,
    repo: s.repo,
    branch: s.branch,
    workflow: s.workflow,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const patch: Record<string, string> = {};
  for (const k of ["token", "owner", "repo", "branch", "workflow"] as const) {
    if (typeof body[k] === "string") patch[k] = body[k].trim();
  }
  if (!("token" in patch) && (patch.owner || patch.repo)) {
    // keep existing token
  }
  const current = await loadGithubSettings();
  if (!patch.token && current.token) patch.token = current.token;
  await saveGithubSettings(patch);

  const next = await loadGithubSettings();
  if (body.test && next.token) {
    try {
      const login = await ghWhoami(next);
      return NextResponse.json({ ok: true, login });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof GithubError ? e.message : "Connection test failed" },
        { status: 502 },
      );
    }
  }
  return NextResponse.json({ ok: true });
}
