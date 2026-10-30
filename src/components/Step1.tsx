"use client";

import { useRef } from "react";
import { Btn, Field, Icon, Seg, fmtBytes } from "./ui";
import { WizardForm } from "./wizardTypes";

export default function Step1({ form, setForm, onNext }: { form: WizardForm; setForm: (f: WizardForm) => void; onNext: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const isWebsite = form.sourceType === "website";

  const canContinue = isWebsite
    ? /^https?:\/\/.+\..+/.test(form.url.trim())
    : Boolean(form.file);

  const pickFile = () => fileInput.current?.click();

  return (
    <div className="space-y-5 apex-fade-up">
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-sm font-bold text-ink-50 flex items-center gap-2">
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-ink-750 border border-ink-700 text-apex-400">01</span>
              Source Selection
            </h2>
            <p className="text-xs text-ink-300 mt-1">Where does the web project come from?</p>
          </div>
          <Seg
            value={form.sourceType}
            onChange={(v) => setForm({ ...form, sourceType: v })}
            options={[
              { value: "upload", label: "Upload", icon: "upload" },
              { value: "website", label: "Website", icon: "globe" },
            ]}
          />
        </div>

        {!isWebsite ? (
          <div className="mt-5 space-y-4">
            <Field label="Upload type">
              <Seg
                value={form.fileType}
                onChange={(v) => setForm({ ...form, fileType: v, file: null })}
                options={[
                  { value: "html", label: "HTML — single .html file", icon: "file" },
                  { value: "zip", label: "ZIP — project folder", icon: "zip" },
                ]}
              />
            </Field>

            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept={form.fileType === "html" ? ".html,.htm,.xhtml,text/html" : ".zip,application/zip"}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setForm({ ...form, file: f });
                e.target.value = "";
              }}
            />

            {form.file ? (
              <div className="flex items-center gap-3 rounded-lg border border-apex-600/40 bg-apex-500/5 px-4 py-3">
                <span className="grid place-items-center w-10 h-10 rounded-lg bg-apex-500/15 text-apex-400 border border-apex-600/30">
                  <Icon name={form.fileType === "zip" ? "zip" : "file"} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink-50 truncate">{form.file.name}</div>
                  <div className="font-mono text-[11px] text-ink-300">{fmtBytes(form.file.size)} · ready to stage on the farm</div>
                </div>
                <button type="button" onClick={() => setForm({ ...form, file: null })} className="text-ink-300 hover:text-danger-400 cursor-pointer">
                  <Icon name="x" size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={pickFile}
                className="w-full rounded-lg border-2 border-dashed border-ink-600 hover:border-apex-600/60 hover:bg-ink-800/50 transition-colors py-8 flex flex-col items-center gap-2 cursor-pointer group"
              >
                <span className="grid place-items-center w-12 h-12 rounded-xl bg-ink-800 border border-ink-600 text-ink-300 group-hover:text-apex-400 group-hover:border-apex-600/50 transition-colors">
                  <Icon name="upload" size={20} />
                </span>
                <span className="text-sm font-semibold text-ink-100">
                  Choose {form.fileType === "zip" ? "ZIP" : "HTML"} file
                </span>
                <span className="font-mono text-[11px] text-ink-400">
                  {form.fileType === "zip" ? "application/zip · up to 200 MB" : "text/html · up to 200 MB"}
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5">
            <Field label="Website URL" hint="fetched at build time">
              <input
                className="w-full rounded-lg bg-ink-900 border border-ink-600 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-400 outline-none focus:border-apex-600 focus:ring-2 focus:ring-apex-500/15 font-mono"
                placeholder="https://example.com"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </Field>
            <p className="mt-2 text-xs text-ink-300 flex items-center gap-1.5">
              <Icon name="globe" size={13} className="text-apex-400" />
              The wrapper loads this URL inside the WebView. Enable “Cache pages offline” in Step 2 for PWA-style caching.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-ink-700 bg-ink-850 p-5">
        <Field label="Platform" hint="farm builds only ship Android today">
          <div className="relative">
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value as "apk" | "aab" })}
              className="w-full appearance-none rounded-lg bg-ink-900 border border-ink-600 px-3 py-2.5 text-sm text-ink-50 outline-none focus:border-apex-600 cursor-pointer"
            >
              <option value="apk">Android — APK (installable)</option>
              <option value="aab">Android — AAB (Play Store bundle)</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none">
              <Icon name="chevrondown" size={15} />
            </span>
          </div>
        </Field>
      </div>

      <div className="flex justify-end">
        <Btn onClick={onNext} disabled={!canContinue}>
          Continue to App Details <Icon name="chevronright" size={15} />
        </Btn>
      </div>
    </div>
  );
}
