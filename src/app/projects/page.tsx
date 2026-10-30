"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Badge, Btn, Icon, Spinner, fmtBytes, fmtElapsed } from "@/components/ui";

interface Project {
  id: string;
  name: string;
  sourceType: string;
  fileType: string;
  fileName: string | null;
  fileSize: number | null;
  platform: string;
  status: string;
  githubRunId: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  config: { name: string; packageSuffix: string; permissions: string[] };
}

export default function ProjectsPage() {
  const [rows, setRows] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logBusy, setLogBusy] = useState(false);
  const [dlId, setDlId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((j) => setRows(j.projects ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  async function toggleLog(id: string) {
    if (openLog === id) {
      setOpenLog(null);
      return;
    }
    setOpenLog(id);
    setLogBusy(true);
    setLogLines([]);
    try {
      const r = await fetch(`/api/projects/${id}/logs`);
      const j = await r.json();
      setLogLines(j.lines ?? []);
    } catch {
      setLogLines(["could not load logs"]);
    } finally {
      setLogBusy(false);
    }
  }

  async function download(id: string) {
    setDlId(id);
    try {
      const r = await fetch(`/api/projects/${id}/download`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error ?? "Download failed");
        return;
      }
      const cd = r.headers.get("content-disposition") ?? "";
      const m = cd.match(/filename="?([^";]+)"?/);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = m?.[1] ?? "artifact";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      alert("Download failed");
    } finally {
      setDlId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this project and its stored source?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <Shell active="projects" title="Projects & Runs">
      <div className="rounded-xl border border-ink-700 bg-ink-850 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-700 bg-ink-800/60 text-left">
              {["Project", "Source", "Platform", "Status", "Run", "Elapsed", "Created", ""].map((h, i) => (
                <th key={i} className="px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-ink-300 flex items-center justify-center gap-2">
                  <Spinner size={15} /> loading projects…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="text-ink-300 text-sm">No projects yet.</div>
                  <a href="/" className="text-apex-400 text-sm hover:text-apex-300 inline-flex items-center gap-1 mt-2">
                    <Icon name="rocket" size={14} /> Start your first build
                  </a>
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const elapsed =
                p.startedAt && p.finishedAt
                  ? fmtElapsed(new Date(p.finishedAt).getTime() - new Date(p.startedAt).getTime())
                  : p.startedAt && !p.finishedAt && ["building", "queued"].includes(p.status)
                    ? "running…"
                    : "—";
              const open = openLog === p.id;
              return (
                <>
                  <tr key={p.id} className="border-b border-ink-750 hover:bg-ink-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink-50">{p.name}</div>
                      <div className="font-mono text-[10.5px] text-ink-400">com.{p.config?.packageSuffix ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-200">
                        <Icon name={p.fileType === "zip" ? "zip" : p.fileType === "url" ? "globe" : "file"} size={13} className="text-ink-300" />
                        {p.fileType === "url" ? "website" : p.fileType}
                        <span className="text-ink-400">{p.fileType !== "url" && p.fileSize ? fmtBytes(p.fileSize) : ""}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink-200 uppercase">{p.platform}</td>
                    <td className="px-4 py-3">
                      <Badge state={p.status} />
                      {p.error && p.status === "failed" && (
                        <div className="text-[10.5px] text-danger-400 mt-1 max-w-[220px] truncate" title={p.error}>
                          {p.error}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink-300">{p.githubRunId ? `#${p.githubRunId}` : "—"}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink-200">{elapsed}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink-400">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => toggleLog(p.id)}
                          className={`p-1.5 rounded-md border transition-colors cursor-pointer ${open ? "border-apex-600/50 text-apex-400 bg-apex-500/10" : "border-ink-600 text-ink-300 hover:text-ink-50"}`}
                          title="Toggle log"
                        >
                          {logBusy && open ? <Spinner size={13} /> : <Icon name="terminal" size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => download(p.id)}
                          disabled={p.status !== "ready" || dlId === p.id}
                          className="p-1.5 rounded-md border border-ink-600 text-ink-300 hover:text-apex-400 hover:border-apex-600/50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Download artifact"
                        >
                          {dlId === p.id ? <Spinner size={13} /> : <Icon name="download" size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(p.id)}
                          className="p-1.5 rounded-md border border-ink-600 text-ink-300 hover:text-danger-400 hover:border-danger-600/50 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr key={`${p.id}-log`} className="bg-ink-950">
                      <td colSpan={8} className="px-0 py-0">
                        <div className="mx-4 my-3 rounded-lg border border-ink-700 bg-ink-950 overflow-hidden">
                          <div className="px-3 py-1.5 border-b border-ink-800 font-mono text-[10px] text-ink-400 flex items-center gap-2">
                            <Icon name="terminal" size={11} className="text-apex-400" />
                            runner log · tail
                          </div>
                          <pre className="p-3 font-mono text-[11px] leading-relaxed text-[#9fdcb2] max-h-72 overflow-y-auto whitespace-pre-wrap">
                            {logLines.length ? logLines.join("\n") : "no log lines available"}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
