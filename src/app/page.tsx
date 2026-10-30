"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import Step1 from "@/components/Step1";
import Step2 from "@/components/Step2";
import Step3 from "@/components/Step3";
import { Icon } from "@/components/ui";
import { DEFAULT_FORM, WizardForm, formToConfig } from "@/components/wizardTypes";

const STEPS = [
  { n: "01", label: "Source" },
  { n: "02", label: "App Details" },
  { n: "03", label: "Build" },
];

export default function BuildPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setFormState] = useState<WizardForm>(DEFAULT_FORM);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const setForm = (f: WizardForm) => {
    setFormState(f);
    setError(null);
  };

  async function startBuild() {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("sourceType", form.sourceType);
      fd.append("fileType", form.fileType);
      fd.append("platform", form.platform);
      fd.append("url", form.url);
      fd.append("config", JSON.stringify(formToConfig(form)));
      if (form.sourceType === "upload" && form.file) fd.append("file", form.file);

      const cr = await fetch("/api/projects", { method: "POST", body: fd });
      const cj = await cr.json();
      if (!cr.ok) throw new Error(cj.error ?? "Could not create project");
      const id: string = cj.id;

      const sr = await fetch(`/api/projects/${id}/start`, { method: "POST" });
      const sj = await sr.json();
      if (!sr.ok) throw new Error(sj.error ?? "Dispatch to GitHub Actions failed");

      setProjectId(id);
      setStarted(true);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Build start failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell active="build" title="New Build">
      {/* Step pills */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => {
          const idx = (i + 1) as 1 | 2 | 3;
          const active = step === idx;
          const passed = step > idx;
          return (
            <div key={s.n} className="flex items-center gap-2">
              <button
                type="button"
                disabled={started && idx !== 3}
                onClick={() => {
                  if (!started || idx === step) setStep(idx);
                }}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-left transition-all cursor-pointer disabled:cursor-not-allowed ${
                  active
                    ? "border-apex-600/60 bg-apex-500/10"
                    : passed
                      ? "border-ink-700 bg-ink-850"
                      : "border-ink-700 bg-ink-850/50 opacity-60"
                }`}
              >
                <span
                  className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                    passed ? "bg-apex-500 text-ink-950" : active ? "text-apex-400" : "text-ink-400"
                  }`}
                >
                  {passed ? "✓" : s.n}
                </span>
                <span className={`text-xs font-semibold ${active ? "text-ink-50" : "text-ink-300"}`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="w-6 h-px bg-ink-700" />}
            </div>
          );
        })}
        <span className="ml-auto hidden lg:flex items-center gap-2 font-mono text-[10.5px] text-ink-400">
          <Icon name="github" size={13} />
          compiles on a GitHub Actions runner — nothing runs on this device
        </span>
      </div>

      {step === 1 && (
        <Step1
          form={form}
          setForm={setForm}
          onNext={() => {
            if (form.sourceType === "upload" && !form.file) return;
            if (form.sourceType === "website" && !/^https?:\/\/.+\..+/.test(form.url.trim())) return;
            if (!form.name && form.sourceType === "upload") {
              const base = (form.file?.name ?? "app").replace(/\.(html?|zip)$/i, "");
              setForm({ ...form, name: base.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40) });
            }
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <Step2 form={form} setForm={setForm} onBack={() => setStep(1)} onStart={startBuild} busy={busy} error={error} />
      )}

      {step === 3 && projectId && (
        <Step3
          projectId={projectId}
          appName={form.name}
          appId={`com.${form.packageSuffix.replace(/^com\./, "")}`}
          platform={form.platform}
          onBack={() => setStep(2)}
          onEdit={() => {
            setStarted(false);
            setProjectId(null);
            setStep(2);
          }}
        />
      )}
    </Shell>
  );
}
