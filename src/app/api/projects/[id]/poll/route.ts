import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import {
  GithubError,
  ghFindRunAfter,
  ghGetJobs,
  ghGetRun,
  ghListArtifacts,
  loadGithubSettings,
  type JobInfo,
} from "@/lib/github";

type StageKey = "upload" | "prepare" | "build" | "ready";
interface StageOut {
  key: StageKey;
  label: string;
  state: "pending" | "active" | "done" | "failed";
  detail: string;
}

function stepState(s: { status: string; conclusion: string | null }): "pending" | "active" | "done" | "failed" {
  if (s.status === "completed") return s.conclusion === "success" ? "done" : "failed";
  if (s.status === "in_progress") return "active";
  return "pending";
}

function mapStages(jobs: JobInfo[]): StageOut[] {
  const stages: StageOut[] = [
    { key: "upload", label: "Upload", state: "pending", detail: "Stage sources in the farm repo" },
    { key: "prepare", label: "Prepare", state: "pending", detail: "Manifest, permissions, splash & colors" },
    { key: "build", label: "Build", state: "pending", detail: "Gradle assembleRelease" },
    { key: "ready", label: "Ready", state: "pending", detail: "Sign, verify & publish artifact" },
  ];
  const findStep = (pred: (name: string) => boolean) => {
    for (const job of jobs) {
      const step = job.steps.find((st) => pred(st.name.toLowerCase()));
      if (step) return step;
    }
    return null;
  };
  const apply = (key: StageKey, st: { status: string; conclusion: string | null } | null, detail: string) => {
    const out = stages.find((s) => s.key === key)!;
    out.state = st ? stepState(st) : out.state;
    if (st && st.conclusion) out.detail = detail;
  };
  apply("upload", findStep((n) => n.includes("stage sources")), "Sources staged into workdir");
  apply("prepare", findStep((n) => n.includes("configure")), "Project configured from config.json");
  apply("build", findStep((n) => n.includes("build release")), "APK assembled by Gradle");
  const readyStep = findStep((n) => n.includes("sign") || n.includes("artifact"));
  apply("ready", readyStep, "Artifact signed & uploaded");
  // If a stage fails, everything after stays pending.
  for (let i = 0; i < stages.length; i++) {
    if (stages[i].state === "failed") {
      for (let j = i + 1; j < stages.length; j++) if (stages[j].state !== "done") stages[j].state = "pending";
    }
  }
  return stages;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!rows.length) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const row = rows[0];
  if (!["building", "queued", "ready", "failed"].includes(row.status)) {
    return NextResponse.json({ status: row.status, stages: [], runId: null, runUrl: null, runStartedAt: null });
  }

  const s = await loadGithubSettings();
  try {
    let runId = row.githubRunId ? Number(row.githubRunId) : null;
    if (!runId) {
      const run = await ghFindRunAfter(s, s.workflow, (row.startedAt ?? row.createdAt).toISOString());
      if (!run) {
        return NextResponse.json({
          status: "building",
          stages: mapStages([]),
          runId: null,
          runUrl: null,
          runStartedAt: null,
          note: "Waiting for workflow run to appear…",
        });
      }
      runId = run.id;
      await db.update(projects).set({ githubRunId: String(runId) }).where(eq(projects.id, id));
    }

    const run = await ghGetRun(s, runId);
    const jobs = await ghGetJobs(s, runId);
    const stages = mapStages(jobs);
    let status = row.status;
    let error = row.error;
    let artifactId = row.githubArtifactId;
    let artifactName = row.githubArtifactName;

    if (run.status === "completed") {
      if (run.conclusion === "success") {
        status = "ready";
        if (!artifactId) {
          const artifacts = await ghListArtifacts(s, runId);
          const match = artifacts.find((a) => a.name.includes(id)) ?? artifacts[0];
          if (match) {
            artifactId = String(match.id);
            artifactName = match.name;
          }
        }
        await db
          .update(projects)
          .set({
            status,
            githubRunId: String(runId),
            githubArtifactId: artifactId,
            githubArtifactName: artifactName,
            finishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(projects.id, id));
      } else {
        status = "failed";
        error = `Workflow finished with conclusion: ${run.conclusion}`;
        await db
          .update(projects)
          .set({ status, error, githubRunId: String(runId), finishedAt: new Date(), updatedAt: new Date() })
          .where(eq(projects.id, id));
      }
    }

    return NextResponse.json({
      status,
      error,
      stages,
      runId: String(runId),
      runUrl: run.html_url,
      runStartedAt: run.run_started_at,
      runStatus: run.status,
      conclusion: run.conclusion,
    });
  } catch (e) {
    const msg = e instanceof GithubError ? e.message : e instanceof Error ? e.message : "Poll failed";
    return NextResponse.json({ status: row.status, error: msg, stages: mapStages([]), runId: row.githubRunId });
  }
}
