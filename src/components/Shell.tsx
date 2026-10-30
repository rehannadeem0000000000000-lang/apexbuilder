"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "./ui";

const NAV = [
  { key: "build", href: "/", label: "Build", icon: "rocket", hint: "3-step APK forge" },
  { key: "projects", href: "/projects", label: "Projects", icon: "box", hint: "Runs & artifacts" },
  { key: "sources", href: "/sources", label: "Source Code", icon: "filecode", hint: "Kotlin app + CI" },
  { key: "settings", href: "/settings", label: "Settings", icon: "sliders", hint: "GitHub connection" },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-4 h-16 border-b border-ink-800">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <path d="M16 3 29 27H3L16 3z" fill="none" stroke="#3ddc84" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M16 12.5 21.5 23h-11L16 12.5z" fill="#3ddc84" />
      </svg>
      <div className="leading-none">
        <div className="font-bold text-[15px] tracking-tight text-ink-50">
          APEX<span className="text-apex-400">BUILDER</span>
        </div>
        <div className="text-[10px] font-mono text-ink-300 mt-1 tracking-widest">CLOUD APK FORGE</div>
      </div>
    </div>
  );
}

export default function Shell({ active, title, children }: { active: string; title: string; children: ReactNode }) {
  const [gh, setGh] = useState<{ connected: boolean; owner: string; repo: string; tokenLast4: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setGh)
      .catch(() => setGh(null));
  }, []);

  return (
    <div className="min-h-screen flex">
      <aside className="w-[236px] shrink-0 border-r border-ink-800 bg-ink-900 flex flex-col fixed inset-y-0 left-0 z-40">
        <Logo />
        <nav className="flex-1 py-3 px-2.5 space-y-0.5">
          {NAV.map((n) => {
            const activeItem = active === n.key;
            return (
              <Link
                key={n.key}
                href={n.href}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  activeItem ? "bg-ink-750 text-ink-50" : "text-ink-300 hover:text-ink-100 hover:bg-ink-850"
                }`}
              >
                {activeItem && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-apex-500" />}
                <Icon name={n.icon} size={17} className={activeItem ? "text-apex-400" : "text-ink-300"} />
                <span className="flex-1">
                  <span className="block text-[13.5px] font-semibold leading-none">{n.label}</span>
                  <span className="block text-[10.5px] text-ink-400 mt-1 leading-none font-mono">{n.hint}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-ink-800">
          {gh === null ? (
            <div className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-xs text-ink-300">Checking GitHub…</div>
          ) : gh.connected ? (
            <a
              href={`https://github.com/${gh.owner}/${gh.repo}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 rounded-lg border border-apex-600/30 bg-apex-500/5 px-3 py-2.5 hover:bg-apex-500/10 transition-colors"
            >
              <Icon name="github" size={16} className="text-apex-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold text-ink-100 truncate">
                  {gh.owner}/{gh.repo}
                </span>
                <span className="block text-[10px] font-mono text-ink-300">
                  farm repo · token ····{gh.tokenLast4}
                </span>
              </span>
              <Icon name="external" size={12} className="text-ink-400" />
            </a>
          ) : (
            <Link
              href="/settings"
              className="flex items-center gap-2.5 rounded-lg border border-amberx-500/30 bg-amberx-500/5 px-3 py-2.5 hover:bg-amberx-500/10 transition-colors"
            >
              <Icon name="github" size={16} className="text-amberx-400" />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold text-ink-100">GitHub not connected</span>
                <span className="block text-[10px] font-mono text-ink-300">open settings →</span>
              </span>
            </Link>
          )}
        </div>
      </aside>

      <div className="flex-1 ml-[236px] flex flex-col min-w-0">
        <header className="h-16 border-b border-ink-800 bg-ink-900/80 backdrop-blur sticky top-0 z-30 flex items-center px-7 gap-4">
          <h1 className="text-[15px] font-bold tracking-tight text-ink-50">{title}</h1>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded border border-ink-700 bg-ink-850 text-ink-300 tracking-widest">
            GITHUB ACTIONS PIPELINE
          </span>
          <span className="ml-auto font-mono text-[11px] text-ink-400 hidden md:block">
            upload → dispatch → build → download
          </span>
        </header>
        <main className="flex-1 px-7 py-6 max-w-[1200px] w-full mx-auto">{children}</main>
        <footer className="px-7 py-4 border-t border-ink-800/60 flex items-center gap-3 font-mono text-[10.5px] text-ink-400">
          <span className="w-1.5 h-1.5 rounded-full bg-apex-500 apex-pulse" />
          apex.farm v1.0 · all APKs compiled on GitHub Actions runners · no on-device compilation
        </footer>
      </div>
    </div>
  );
}
