"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Btn, Icon, Spinner, fmtElapsed, useAutoScroll } from "./ui";

interface Stage {
  key: string;
  label: string;
  state: "pending" | "active" | "done" | "failed";
  detail: string;
}

interface PollOut {
  status: string;
  error?: string;
  stages: Stage[];
  runId?: string | null;
  runUrl?: string | null;
  runStartedAt?: string | null;
  conclusion?: string | null;
  note?: string;
}

export default function Step3({
  projectId,
  appName,
  appId,
  platform,
  onBack,
  onEdit,
}: {
  projectId: string;
  appName: string;
  appId: string;
  platform: "apk" | "aab";
  onBack: () => void;
  onEdit: () => void;
}) {
  const [poll, setPoll] = useState<PollOut | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [logComplete, setLogComplete] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState<string | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActive = useRef<string>("");

  const done = poll?.status === "ready";
  const failed = poll?.status === "failed";
  const running = !done && !failed;

  const fetchPoll = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects/${projectId}/poll`);
      const j = await r.json();
      setPoll(j);
      return j as PollOut;
    } catch {
      return null;
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const j = await fetchPoll();
      if (cancelled) return;
      if (j && (j.status === "ready" || j.status === "failed")) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        fetchLogs(true);
      } else {
        const sig = JSON.stringify(j?.stages ?? []);
        if (sig !== lastActive.current) {
          lastActive.current = sig;
          fetchLogs(false);
        }
      }
    };
    tick();
    pollTimer.current = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function fetchLogs(force: boolean) {
    try {
      const r = await fetch(`/api/projects/${projectId}/logs`);
      const j = await r.json();
      if (Array.isArray(j.lines)) {
        setLines(j.lines);
        setLogComplete(!!j.complete);
      }
    } catch {
      if (force) setLines((l) => [...l, "⚠ could not refresh logs"]);
    }
  }

  // elapsed timer
  useEffect(() => {
    const started = poll?.runStartedAt ? new Date(poll.runStartedAt).getTime() : null;
    if (!started) return;
    const t = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(t);
  }, [poll?.runStartedAt]);

  async function download() {
    setDownloading(true);
    setDlError(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/download`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `Download failed (${r.status})`);
      }
      const cd = r.headers.get("content-disposition") ?? "";
      const m = cd.match(/filename="?([^";]+)"?/);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = m?.[1] ?? `${appName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-release.${platform}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setDlError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const stages = poll?.stages?.length ? poll.stages : [
    { key: "upload", label: "Upload", state: "pending", detail: "" },
    { key: "prepare", label: "Prepare", state: "pending", detail: "" },
    { key: "build", label: "Build", state: "pending", detail: "" },
    { key: "ready", label: "Ready", state: "pending", detail: "" },
  ];

  const { ref, stick, onScroll } = useAutoScroll(lines, autoFollow);

  return (
    <div className="space-y-5 apex-fade-up">
      {/* Header card */}
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-5 flex items-center gap-4 flex-wrap">
        <span className={`grid place-items-center w-11 h-11 rounded-xl border ${done ? "bg-apex-500/15 border-apex-600/50 text-apex-400" : failed ? "bg-danger-500/10 border-danger-600/50 text-danger-400" : "bg-ink-800 border-ink-600 text-apex-400"}`}>
          {done ? <Icon name="check" size={20} /> : failed ? <Icon name="x" size={20} /> : <Spinner size={20} />}
        </span>
        <div className="flex-1 min-w-[200px]">
          <div className="text-base font-bold text-ink-50 flex items-center gap-2 flex-wrap">
            {appName}
            <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-ink-750 border border-ink-600 text-ink-300 uppercase">{platform}</span>
          </div>
          <div className="font-mono text-[11.5px] text-ink-300 mt-0.5">
            {appId}
            {poll?.runId && <> · run #{poll.runId}</>}
            {poll?.runUrl && (
              <a href={poll.runUrl} target="_blank" rel="noreferrer" className="ml-2 text-apex-400 hover:text-apex-300 inline-flex items-center gap-1">
                view on GitHub <Icon name="external" size={11} />
              </a>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg text-ink-50 leading-none">{fmtElapsed(elapsed)}</div>
          <div className="font-mono text-[10px] text-ink-400 mt-1 tracking-widest uppercase">{running ? "elapsed" : done ? "total" : "stopped"}</div>
        </div>
      </div>

      {/* Stage progress */}
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-5">
        <div className="grid grid-cols-4 gap-3">
          {stages.map((s, i) => {
            const barState = failed && s.state === "pending" ? "pending" : s.state;
            return (
              <div key={s.key}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`grid place-items-center w-5 h-5 rounded-full text-[10px] font-bold border ${
                      barState === "done"
                        ? "bg-apex-500 text-ink-950 border-apex-500"
                        : barState === "active"
                          ? "border-apex-500 text-apex-400 apex-pulse"
                          : barState === "failed"
                            ? "bg-danger-500 text-ink-950 border-danger-500"
                            : "border-ink-600 text-ink-400"
                    }`}
                  >
                    {barState === "done" ? <Icon name="check" size={11} /> : barState === "failed" ? <Icon name="x" size={11} /> : i + 1}
                  </span>
                  <span className={`text-xs font-semibold ${barState === "pending" ? "text-ink-400" : "text-ink-100"}`}>{s.label}</span>
                </div>
                <div className="h-1.5 rounded-full bg-ink-750 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      barState === "failed" ? "bg-danger-500" : barState === "done" ? "bg-apex-500" : barState === "active" ? "bg-apex-500/70 animate-pulse" : "bg-ink-600"
                    }`}
                    style={{ width: barState === "done" ? "100%" : barState === "failed" ? "50%" : barState === "active" ? "60%" : "6%" }}
                  />
                </div>
                <div className="mt-1.5 text-[10.5px] font-mono text-ink-400 truncate">{s.detail || "waiting…"}</div>
              </div>
            );
          })}
        </div>
        {poll?.note && <div className="mt-3 text-[11.5px] font-mono text-amberx-400">{poll.note}</div>}
      </div>

      {/* Result banners */}
      {done && (
        <div className="rounded-xl border border-apex-600/50 bg-apex-500/10 p-5 flex items-center gap-4 flex-wrap apex-fade-up">
          <span className="grid place-items-center w-11 h-11 rounded-full bg-apex-500/20 text-apex-300">
            <Icon name="download" size={20} />
          </span>
          <div className="flex-1 min-w-[220px]">
            <div className="text-sm font-bold text-ink-50">Build succeeded — {platform.toUpperCase()} is ready</div>
            <div className="text-xs text-ink-300 mt-0.5">
              Signed by the farm keystore. Saving to your device’s <span className="font-mono">Downloads</span> folder.
            </div>
            {dlError && <div className="text-xs text-danger-400 mt-1">{dlError}</div>}
          </div>
          <Btn onClick={download} disabled={downloading}>
            {downloading ? <Spinner size={14} /> : <Icon name="download" size={15} />}
            {downloading ? "Fetching artifact…" : `Download ${platform.toUpperCase()}`}
          </Btn>
        </div>
      )}
      {failed && (
        <div className="rounded-xl border border-danger-600/50 bg-danger-500/10 p-5 flex items-center gap-4 flex-wrap apex-fade-up">
          <span className="grid place-items-center w-11 h-11 rounded-full bg-danger-500/15 text-danger-400">
            <Icon name="alert" size={20} />
          </span>
          <div className="flex-1 min-w-[220px]">
            <div className="text-sm font-bold text-ink-50">Build failed</div>
            <div className="text-xs text-ink-300 mt-0.5">{poll?.error ?? "Check the log output below for the failing step."}</div>
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" onClick={onEdit}>
              <Icon name="refresh" size={14} /> Edit config &amp; retry
            </Btn>
          </div>
        </div>
      )}

      {/* Live log */}
      <div className="rounded-xl border border-ink-700 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-ink-800 border-b border-ink-700">
          <Icon name="terminal" size={14} className="text-apex-400" />
          <span className="text-xs font-bold text-ink-100">Live output</span>
          <span className="font-mono text-[10px] text-ink-400">github actions · tail</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoFollow((v) => !v)}
              className={`font-mono text-[10.5px] px-2 py-1 rounded border cursor-pointer transition-colors ${autoFollow ? "border-apex-600/50 text-apex-400 bg-apex-500/10" : "border-ink-600 text-ink-300 hover:text-ink-100"}`}
            >
              {autoFollow ? "● follow" : "○ paused"}
            </button>
            <button type="button" onClick={() => fetchLogs(true)} className="text-ink-300 hover:text-ink-50 cursor-pointer" title="Refresh log">
              <Icon name="refresh" size={14} />
            </button>
          </div>
        </div>
        <div ref={ref} onScroll={onScroll} className="h-[380px] overflow-y-auto bg-ink-950 px-4 py-3 font-mono text-[11.5px] leading-[1.65]">
          {lines.length === 0 && (
            <div className="text-ink-400 flex items-center gap-2 py-2">
              <Spinner size={13} /> waiting for first log lines from the runner…
            </div>
          )}
          {lines.map((l, i) => {
            const isErr = /error|fail|exception|fatal|✗|✖/i.test(l);
            const isInfo = /^\d{4}-\d{2}-\d{2}/.test(l) || /^::/m.test(l);
            return (
              <div key={i} className={`whitespace-pre-wrap break-all ${isErr ? "text-danger-400" : isInfo ? "text-ink-300" : "text-[#9fdcb2]"}`}>
                {l || "\u00A0"}
              </div>
            );
          })}
          {running && <span className="inline-block w-2 h-3.5 bg-apex-400/80 apex-blink align-middle ml-1" />}
        </div>
        {!logComplete && !failed && (
          <div className="px-4 py-1.5 bg-ink-850 border-t border-ink-700/60 font-mono text-[10px] text-ink-400">
            {stick || autoFollow ? "streaming…" : "log paused — scroll to bottom to resume"}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Btn variant="ghost" onClick={onBack}>
          <Icon name="chevronright" size={15} className="rotate-180" /> Back to editor
        </Btn>
        {done && (
          <Btn variant="outline" onClick={onEdit}>
            <Icon name="refresh" size={14} /> New build from this config
          </Btn>
        )}
      </div>
    </div>
  );
}
