"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Btn, Field, Icon, Spinner, inputCls } from "@/components/ui";

interface Current {
  connected: boolean;
  hasToken: boolean;
  tokenLast4: string | null;
  owner: string;
  repo: string;
  branch: string;
  workflow: string;
}

export default function SettingsPage() {
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [workflow, setWorkflow] = useState("build-apk.yml");
  const [loaded, setLoaded] = useState<Current | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        setLoaded(j);
        setOwner(j.owner ?? "");
        setRepo(j.repo ?? "");
        setBranch(j.branch ?? "main");
        setWorkflow(j.workflow ?? "build-apk.yml");
      });
  }, []);

  async function save(test: boolean) {
    setSaving(true);
    setTesting(test);
    setMsg(null);
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token || undefined,
          owner,
          repo,
          branch: branch || "main",
          workflow: workflow || "build-apk.yml",
          test,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg({ ok: true, text: test ? `Connected as @${j.login}` : "Saved. Builds will dispatch to this farm repo." });
        setToken("");
        const fresh = await r2();
        setLoaded(fresh);
      } else {
        setMsg({ ok: false, text: j.error ?? "Save failed" });
      }
    } catch {
      setMsg({ ok: false, text: "Save failed" });
    } finally {
      setSaving(false);
      setTesting(false);
    }
  }

  async function r2() {
    const r = await fetch("/api/settings");
    return r.json();
  }

  return (
    <Shell active="settings" title="GitHub Connection">
      <div className="max-w-2xl space-y-5">
        <div className="rounded-xl border border-ink-700 bg-ink-850 p-5 text-[13px] text-ink-200 leading-relaxed">
          <p>
            ApexBuilder pushes your <code className="font-mono text-apex-400 text-[12px]">source + config.json</code> into a farm
            repository and triggers <code className="font-mono text-apex-400 text-[12px]">build-apk.yml</code> via{" "}
            <code className="font-mono text-apex-400 text-[12px]">workflow_dispatch</code>. The token lives server-side only — it
            never reaches the browser.
          </p>
          <ul className="mt-3 space-y-1.5 font-mono text-[11.5px] text-ink-300">
            <li className="flex items-center gap-2"><Icon name="check" size={12} className="text-apex-400" /> token needs <b>Contents: read/write</b> + <b>Actions: read</b></li>
            <li className="flex items-center gap-2"><Icon name="check" size={12} className="text-apex-400" /> farm repo = this project (contains the workflow + templates)</li>
            <li className="flex items-center gap-2"><Icon name="check" size={12} className="text-apex-400" /> secrets: <b>APEX_KEYSTORE_B64</b> · <b>APEX_KEYSTORE_PASS</b> · <b>APEX_KEY_ALIAS</b> · <b>APEX_KEY_PASS</b></li>
          </ul>
        </div>

        <div className="rounded-xl border border-ink-700 bg-ink-850 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink-50 flex items-center gap-2">
              <Icon name="github" size={16} className="text-ink-200" /> Farm repository
            </h2>
            {loaded?.connected ? (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-apex-400">
                <span className="w-1.5 h-1.5 rounded-full bg-apex-400" /> connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amberx-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amberx-400" /> not connected
              </span>
            )}
          </div>

          <Field label="GitHub personal access token" hint={loaded?.hasToken ? `stored ····${loaded.tokenLast4}` : "none stored"}>
            <input
              className={`${inputCls} font-mono`}
              type="password"
              placeholder={loaded?.hasToken ? `stored token (····${loaded.tokenLast4}) — leave blank to keep` : "ghp_… / github_pat_…"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Owner">
              <input className={`${inputCls} font-mono`} placeholder="octocat" value={owner} onChange={(e) => setOwner(e.target.value)} />
            </Field>
            <Field label="Farm repo">
              <input className={`${inputCls} font-mono`} placeholder="apex-farm" value={repo} onChange={(e) => setRepo(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Branch">
              <input className={`${inputCls} font-mono`} placeholder="main" value={branch} onChange={(e) => setBranch(e.target.value)} />
            </Field>
            <Field label="Workflow file">
              <input className={`${inputCls} font-mono`} placeholder="build-apk.yml" value={workflow} onChange={(e) => setWorkflow(e.target.value)} />
            </Field>
          </div>

          {msg && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
                msg.ok ? "border-apex-600/50 bg-apex-500/10 text-apex-300" : "border-danger-600/50 bg-danger-500/10 text-danger-400"
              }`}
            >
              <Icon name={msg.ok ? "check" : "alert"} size={15} /> {msg.text}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Btn onClick={() => save(false)} disabled={saving || (!owner && !repo)}>
              {saving && !testing ? <Spinner size={14} /> : <Icon name="check" size={14} />} Save connection
            </Btn>
            <Btn variant="outline" onClick={() => save(true)} disabled={saving || testing}>
              {testing ? <Spinner size={14} /> : <Icon name="terminal" size={14} />} Test connection
            </Btn>
          </div>
        </div>
      </div>
    </Shell>
  );
}
