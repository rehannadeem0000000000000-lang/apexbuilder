"use client";

import { useRef, useState } from "react";
import { Btn, Field, Icon, Section, Seg, Spinner, Toggle, inputCls } from "./ui";
import { PERMISSION_DEFS, WizardForm, fileToMedia, sanitizePackage } from "./wizardTypes";

export default function Step2({
  form,
  setForm,
  onBack,
  onStart,
  busy,
  error,
}: {
  form: WizardForm;
  setForm: (f: WizardForm) => void;
  onBack: () => void;
  onStart: () => void;
  busy: boolean;
  error: string | null;
}) {
  const iconInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const gsInput = useRef<HTMLInputElement>(null);
  const [gsLoading, setGsLoading] = useState(false);

  const permCount = Object.values(form.permissions).filter(Boolean).length;

  const canStart =
    form.name.trim().length > 0 &&
    sanitizePackage(form.packageSuffix).length > 0 &&
    !(form.startupMode === "custom" && !form.startupMedia);

  return (
    <div className="space-y-4 apex-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-ink-50 flex items-center gap-2">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-ink-750 border border-ink-700 text-apex-400">02</span>
            App Details &amp; Options
          </h2>
          <p className="text-xs text-ink-300 mt-1">Everything is serialized into <code className="font-mono text-[11px] text-apex-400">config.json</code> for the farm.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-600/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-400 flex items-center gap-2">
          <Icon name="alert" size={15} /> {error}
        </div>
      )}

      {/* Identity */}
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-5">
        <div className="flex gap-5 flex-wrap">
          <input
            ref={iconInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setForm({ ...form, icon: await fileToMedia(f) });
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => iconInput.current?.click()}
            className="group relative w-[88px] h-[88px] rounded-xl border border-ink-600 hover:border-apex-600/70 overflow-hidden bg-ink-900 cursor-pointer shrink-0"
          >
            {form.icon ? (
              <img src={form.icon.dataUrl} alt="app icon" className="w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-ink-400 group-hover:text-apex-400 transition-colors">
                <Icon name="image" size={22} />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-ink-950/85 text-[9.5px] font-mono text-ink-200 py-1 text-center group-hover:text-apex-300">
              {form.icon ? "replace" : "upload"}
            </span>
          </button>
          <div className="flex-1 min-w-[240px] space-y-4">
            <Field label="App Name" hint="launcher label">
              <input
                className={inputCls}
                placeholder="My Awesome App"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Package Suffix" hint="a–z, 0–9">
              <div className="flex items-center">
                <span className="h-[42px] flex items-center px-3 rounded-l-lg bg-ink-750 border border-r-0 border-ink-600 font-mono text-sm text-ink-300">com.</span>
                <input
                  className={`${inputCls} rounded-l-none font-mono`}
                  placeholder="myapp"
                  value={form.packageSuffix}
                  onChange={(e) => setForm({ ...form, packageSuffix: sanitizePackage(e.target.value) })}
                />
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-ink-400">
                applicationId → com.{sanitizePackage(form.packageSuffix) || "myapp"}
              </p>
            </Field>
          </div>
        </div>
      </div>

      {/* Advanced */}
      <Section title="Advanced" icon="layers" desc="App Links domain · Google Sign-In" defaultOpen={false}>
        <div className="space-y-4 pt-2">
          <Field label="App Links domain" hint="optional · android:autoVerify">
            <input
              className={`${inputCls} font-mono`}
              placeholder="app.example.com"
              value={form.appLinksDomain}
              onChange={(e) => setForm({ ...form, appLinksDomain: e.target.value })}
            />
          </Field>
          <div>
            <Toggle
              checked={form.googleEnabled}
              onChange={(v) => setForm({ ...form, googleEnabled: v })}
              label="Google Sign-In"
              desc="Wire google-services.json or a Web Client ID into the wrapper."
            />
            {form.googleEnabled && (
              <div className="mt-2 space-y-3 rounded-lg border border-ink-700 bg-ink-900/60 p-3 apex-fade-up">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={gsInput}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setGsLoading(true);
                        const text = await f.text();
                        setForm({ ...form, googleServices: text });
                        setGsLoading(false);
                      }
                      e.target.value = "";
                    }}
                  />
                  <Btn variant="outline" onClick={() => gsInput.current?.click()} disabled={gsLoading}>
                    {gsLoading ? <Spinner size={13} /> : <Icon name="upload" size={13} />}
                    {form.googleServices ? "Replace google-services.json" : "Upload google-services.json"}
                  </Btn>
                  {form.googleServices && (
                    <span className="font-mono text-[11px] text-apex-400 flex items-center gap-1">
                      <Icon name="check" size={12} /> loaded ({Math.round(form.googleServices.length / 1024)} KB)
                    </span>
                  )}
                </div>
                <Field label="Or paste Web Client ID">
                  <input
                    className={`${inputCls} font-mono`}
                    placeholder="123456789-abcdef.apps.googleusercontent.com"
                    value={form.googleClientId}
                    onChange={(e) => setForm({ ...form, googleClientId: e.target.value })}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Permissions */}
      <Section
        title="Permissions"
        icon="shield"
        desc="Mapped 1:1 to <uses-permission> tags in the generated manifest"
        defaultOpen
        badge={
          <span className="font-mono text-[10.5px] px-2 py-0.5 rounded-full bg-ink-750 border border-ink-600 text-ink-300">
            {permCount}/10
          </span>
        }
      >
        <div className="grid md:grid-cols-2 gap-x-6 pt-2">
          {PERMISSION_DEFS.map((p) => (
            <Toggle
              key={p.key}
              checked={!!form.permissions[p.key]}
              onChange={(v) => setForm({ ...form, permissions: { ...form.permissions, [p.key]: v } })}
              label={
                <span className="flex items-center gap-2">
                  <Icon name={p.icon} size={14} className={form.permissions[p.key] ? "text-apex-400" : "text-ink-400"} />
                  {p.label}
                </span> as unknown as string
              }
              mono={p.mono}
            />
          ))}
        </div>
      </Section>

      {/* Protection */}
      <Section title="Protection" icon="lock" desc="DEX hardening via R8/ProGuard on the farm" defaultOpen={false}>
        <div className="pt-2">
          <Toggle
            checked={form.dex2c}
            onChange={(v) => setForm({ ...form, dex2c: v })}
            label="Dex2C protection"
            desc="DEX→native hardening pass; enables R8 full mode + aggressive shrinking."
            mono="r8 fullmode"
          />
          <Toggle
            checked={form.stringProtection}
            onChange={(v) => setForm({ ...form, stringProtection: v })}
            label="String protection"
            desc="Obfuscates class names & repackage strings to resist static decompilation."
            mono="-repackageclasses"
          />
        </div>
      </Section>

      {/* Performance */}
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-5">
        <h3 className="text-sm font-bold text-ink-50 flex items-center gap-2 mb-1">
          <Icon name="bolt" size={15} className="text-apex-400" /> Performance
        </h3>
        <div className="-mt-1">
          <Toggle
            checked={form.offlineCache}
            onChange={(v) => setForm({ ...form, offlineCache: v })}
            label="Cache pages offline"
            desc="Serves the app over https scheme so WebView + service workers persist offline."
            mono="androidScheme=https"
          />
        </div>
      </div>

      {/* Startup loading */}
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-bold text-ink-50 flex items-center gap-2">
            <Icon name="rocket" size={15} className="text-apex-400" /> Startup loading
          </h3>
          <Seg
            value={form.startupMode}
            onChange={(v) => setForm({ ...form, startupMode: v, startupMedia: v === "custom" ? form.startupMedia : null })}
            options={[
              { value: "off", label: "Off" },
              { value: "none", label: "None" },
              { value: "custom", label: "Custom" },
            ]}
          />
        </div>
        {form.startupMode === "custom" && (
          <div className="mt-4 rounded-lg border border-ink-700 bg-ink-900/60 p-4 apex-fade-up">
            <input
              ref={mediaInput}
              type="file"
              accept="video/mp4,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f && f.size < 12 * 1024 * 1024) setForm({ ...form, startupMedia: await fileToMedia(f) });
                e.target.value = "";
              }}
            />
            {form.startupMedia ? (
              <div className="flex items-center gap-3">
                {form.startupMedia.name.toLowerCase().endsWith(".mp4") ? (
                  <span className="grid place-items-center w-12 h-12 rounded-lg bg-ink-750 border border-ink-600 text-apex-400">
                    <Icon name="film" size={18} />
                  </span>
                ) : (
                  <img src={form.startupMedia.dataUrl} alt="splash" className="w-12 h-12 rounded-lg object-cover border border-ink-600" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-50 truncate">{form.startupMedia.name}</div>
                  <div className="font-mono text-[11px] text-ink-300">shown during cold start</div>
                </div>
                <Btn variant="ghost" onClick={() => setForm({ ...form, startupMedia: null })}>
                  <Icon name="x" size={14} />
                </Btn>
              </div>
            ) : (
              <Btn variant="outline" onClick={() => mediaInput.current?.click()}>
                <Icon name="upload" size={14} /> Choose MP4 / image (≤ 12 MB)
              </Btn>
            )}
          </div>
        )}
      </div>

      {/* Signing */}
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-5">
        <h3 className="text-sm font-bold text-ink-50 flex items-center gap-2 mb-1">
          <Icon name="key" size={15} className="text-apex-400" /> Signing
        </h3>
        <div className="-mt-1">
          <Toggle
            checked={form.signRelease}
            onChange={(v) => setForm({ ...form, signRelease: v, ownerKey: v ? form.ownerKey : "" })}
            label="Sign as release build"
            desc="Uses the farm keystore from GitHub Secrets. Leave owner key blank to use the default."
          />
        </div>
        {form.signRelease && (
          <div className="mt-2 pt-3 border-t border-ink-700/60">
            <Field label="Owner key" hint="base64 keystore · default blank">
              <input
                className={`${inputCls} font-mono`}
                type="password"
                placeholder="Leave blank → use APEX_KEYSTORE_B64 repo secret"
                value={form.ownerKey}
                onChange={(e) => setForm({ ...form, ownerKey: e.target.value })}
              />
            </Field>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Btn variant="ghost" onClick={onBack} disabled={busy}>
          <Icon name="chevronright" size={15} className="rotate-180" /> Back
        </Btn>
        <Btn onClick={onStart} disabled={!canStart || busy}>
          {busy ? <Spinner size={14} /> : <Icon name="play" size={14} />}
          {busy ? "Dispatching to GitHub Actions…" : "Start Cloud Build"}
        </Btn>
      </div>
    </div>
  );
}
