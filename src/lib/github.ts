import { eq } from "drizzle-orm";
import JSZip from "jszip";
import { db } from "@/db";
import { settings } from "@/db/schema";

export interface GithubSettings {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  workflow: string;
}

const ENV_FALLBACKS: GithubSettings = {
  token: process.env.GITHUB_TOKEN ?? "",
  owner: process.env.GITHUB_OWNER ?? "",
  repo: process.env.GITHUB_REPO ?? "",
  branch: process.env.GITHUB_BRANCH ?? "main",
  workflow: "build-apk.yml",
};

export async function loadGithubSettings(): Promise<GithubSettings> {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    token: map.token || ENV_FALLBACKS.token,
    owner: map.owner || ENV_FALLBACKS.owner,
    repo: map.repo || ENV_FALLBACKS.repo,
    branch: map.branch || ENV_FALLBACKS.branch,
    workflow: map.workflow || ENV_FALLBACKS.workflow,
  };
}

export async function saveGithubSettings(input: Partial<GithubSettings>): Promise<void> {
  const entries: [string, string][] = [];
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "string" && v.length > 0) entries.push([k, v]);
  }
  if (!entries.length) return;
  for (const [key, value] of entries) {
    const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    if (existing.length) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }
}

export class GithubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function ghRequest(
  s: GithubSettings,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  raw = false,
): Promise<{ status: number; data: any }> {
  if (!s.token) throw new GithubError(401, "No GitHub token configured. Set it in Settings.");
  const res = await fetch(`https://api.github.com/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${s.token}`,
      Accept: raw ? "application/octet-stream" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ApexBuilder-Console",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { status: 204, data: null };
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    const msg =
      (typeof data === "object" && data && (data as any).message) || `${res.status} ${res.statusText}`;
    throw new GithubError(res.status, String(msg));
  }
  return { status: res.status, data };
}

export async function ghWhoami(s: GithubSettings): Promise<string> {
  const { data } = await ghRequest(s, "GET", "user");
  return data.login;
}

export async function ghDefaultBranch(s: GithubSettings): Promise<string> {
  const { data } = await ghRequest(s, "GET", `repos/${s.owner}/${s.repo}`);
  return data.default_branch ?? s.branch;
}

/** Upload a file to the repo via the contents API. Returns the branch used. */
export async function ghUploadFile(
  s: GithubSettings,
  branch: string,
  path: string,
  base64: string,
  message: string,
): Promise<void> {
  let sha: string | null = null;
  try {
    const { data } = await ghRequest(s, "GET", `repos/${s.owner}/${s.repo}/contents/${path}?ref=${branch}`);
    sha = data?.sha ?? null;
  } catch (e) {
    if ((e as GithubError).status !== 404) throw e;
  }
  await ghRequest(s, "PUT", `repos/${s.owner}/${s.repo}/contents/${path}`, {
    message: `[apex] ${message}`,
    content: base64,
    branch,
    ...(sha ? { sha } : {}),
  });
}

export async function ghDispatch(
  s: GithubSettings,
  branch: string,
  workflow: string,
  inputs: Record<string, string>,
): Promise<void> {
  await ghRequest(
    s,
    "POST",
    `repos/${s.owner}/${s.repo}/actions/workflows/${workflow}/dispatches`,
    { ref: branch, inputs },
  );
}

export interface RunInfo {
  id: number;
  status: string;
  conclusion: string | null;
  run_started_at: string | null;
  created_at: string;
  html_url: string;
  name: string;
}

export async function ghFindRunAfter(
  s: GithubSettings,
  workflow: string,
  afterIso: string,
): Promise<RunInfo | null> {
  const { data } = await ghRequest(s, "GET", `repos/${s.owner}/${s.repo}/actions/workflows/${workflow}/runs?per_page=10&branch=${encodeURIComponent(s.branch)}`);
  const runs: RunInfo[] = data.workflow_runs ?? [];
  const found = runs.find((r) => r.created_at >= afterIso);
  return found ?? (runs.length && runs[0].created_at >= afterIso ? runs[0] : null);
}

export async function ghGetRun(s: GithubSettings, runId: number): Promise<RunInfo> {
  const { data } = await ghRequest(s, "GET", `repos/${s.owner}/${s.repo}/actions/runs/${runId}`);
  return data;
}

export interface StepInfo {
  name: string;
  status: string;
  conclusion: string | null;
}
export interface JobInfo {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  steps: StepInfo[];
}

export async function ghGetJobs(s: GithubSettings, runId: number): Promise<JobInfo[]> {
  const { data } = await ghRequest(s, "GET", `repos/${s.owner}/${s.repo}/actions/runs/${runId}/jobs?per_page=25`);
  return data.jobs ?? [];
}

/** Downloads the job log archive (zip) and concatenates every step log in order. */
export async function ghJobLogs(s: GithubSettings, runId: number): Promise<{ text: string; complete: boolean }> {
  const jobs = await ghGetJobs(s, runId);
  if (!jobs.length) return { text: "", complete: false };
  const parts: string[] = [];
  for (const job of jobs) {
    const res = await fetch(`https://api.github.com/repos/${s.owner}/${s.repo}/actions/jobs/${job.id}/logs`, {
      headers: {
        Authorization: `Bearer ${s.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ApexBuilder-Console",
      },
    });
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    try {
      const zip = await JSZip.loadAsync(buf);
      const logs = Object.values(zip.files)
        .filter((f) => !f.dir && f.name.endsWith(".log"))
        .sort((a, b) => {
          const na = a.name.split("step-").pop() ?? "0";
          const nb = b.name.split("step-").pop() ?? "0";
          const aa = parseInt(na) || 0;
          const bb = parseInt(nb) || 0;
          return aa - bb || a.name.localeCompare(b.name);
        });
      for (const f of logs) {
        parts.push(await f.async("string"));
      }
    } catch {
      parts.push(buf.toString("utf8"));
    }
  }
  const text = parts.join("\n");
  return { text, complete: jobs.every((j) => j.status === "completed") };
}

export interface ArtifactInfo {
  id: number;
  name: string;
  size_in_bytes: number;
  created_at: string;
}

export async function ghListArtifacts(s: GithubSettings, runId: number): Promise<ArtifactInfo[]> {
  const { data } = await ghRequest(s, "GET", `repos/${s.owner}/${s.repo}/actions/runs/${runId}/artifacts?per_page=25`);
  return (data.artifacts ?? []) as ArtifactInfo[];
}

/** Downloads an artifact archive and extracts the first entry with the given extension. */
export async function ghDownloadArtifactFile(
  s: GithubSettings,
  artifactId: number,
  ext: string,
): Promise<Buffer> {
  const res = await fetch(
    `https://api.github.com/repos/${s.owner}/${s.repo}/actions/artifacts/${artifactId}/zip`,
    {
      headers: {
        Authorization: `Bearer ${s.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ApexBuilder-Console",
      },
    },
  );
  if (!res.ok) throw new GithubError(res.status, `Artifact download failed (${res.status})`);
  const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
  const entry =
    Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(`.${ext}`)) ??
    Object.values(zip.files).find((f) => !f.dir && !f.name.startsWith("."));
  if (!entry) throw new GithubError(500, `No .${ext} file found inside artifact archive`);
  return await entry.async("nodebuffer");
}
