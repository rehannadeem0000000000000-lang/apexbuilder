"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { Icon, Spinner } from "@/components/ui";

interface Node {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: Node[];
  size?: number;
}

interface FileContent {
  path: string;
  content: string;
  size: number;
  language: string;
}

function TreeNav({ nodes, depth, onPick, selected }: { nodes: Node[]; depth: number; onPick: (p: string) => void; selected: string | null }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <div>
      {nodes.map((n) => {
        if (n.type === "dir") {
          const closed = collapsed[n.path];
          return (
            <div key={n.path}>
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [n.path]: !c[n.path] }))}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-ink-200 hover:bg-ink-800 transition-colors cursor-pointer"
                style={{ paddingLeft: 8 + depth * 14 }}
              >
                <Icon name={closed ? "chevronright" : "chevrondown"} size={12} className="text-ink-400" />
                <Icon name="folder" size={13} className="text-amberx-400/80" />
                <span className="text-[12.5px] font-medium truncate">{n.name}</span>
              </button>
              {!closed && <TreeNav nodes={n.children ?? []} depth={depth + 1} onPick={onPick} selected={selected} />}
            </div>
          );
        }
        const active = selected === n.path;
        return (
          <button
            key={n.path}
            type="button"
            onClick={() => onPick(n.path)}
            className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer ${active ? "bg-apex-500/10 text-apex-300" : "text-ink-300 hover:bg-ink-800 hover:text-ink-100"}`}
            style={{ paddingLeft: 24 + depth * 14 }}
          >
            <Icon
              name={n.name.endsWith(".kt") || n.name.endsWith(".kts") ? "android" : n.name.endsWith(".yml") ? "rocket" : n.name.endsWith(".py") ? "terminal" : "filecode"}
              size={13}
              className={active ? "text-apex-400" : "text-ink-400"}
            />
            <span className="font-mono text-[11.5px] truncate flex-1">{n.name}</span>
            {n.size != null && <span className="font-mono text-[9.5px] text-ink-500">{Math.max(1, Math.round(n.size / 102.4) / 10)}k</span>}
          </button>
        );
      })}
    </div>
  );
}

function renderLine(line: string, key: number) {
  // very light token tinting: comments, strings, keywords
  let html = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const commentIdx = Math.min(
    ...[html.indexOf("//"), html.indexOf("# "), html.indexOf("<!--")].filter((i) => i >= 0),
    Infinity,
  );
  if (commentIdx >= 0) {
    html = html.slice(0, commentIdx) + `<span class="text-ink-400 italic">${html.slice(commentIdx)}</span>`;
  }
  const parts = html.split(/("(?:[^"\\]|\\.)*")/g);
  const out = parts
    .map((p) => (p.startsWith('"') ? `<span class="text-amberx-400/90">${p}</span>` : p))
    .join("");
  return (
    <div key={key} className="flex">
      <span className="w-10 shrink-0 text-right pr-3 text-ink-600 select-none">{key + 1}</span>
      <span className="whitespace-pre" dangerouslySetInnerHTML={{ __html: out || "\u00A0" }} />
    </div>
  );
}

export default function SourcesPage() {
  const [tree, setTree] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<FileContent | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/sources/tree")
      .then((r) => r.json())
      .then((j) => {
        setTree(j.tree ?? []);
        const first = (function find(nodes: Node[]): string | null {
          for (const n of nodes) {
            if (n.type === "file" && (n.name === "build-apk.yml" || n.name === "configure_project.py")) return n.path;
          }
          for (const n of nodes) {
            if (n.children) {
              const f = find(n.children);
              if (f) return f;
            }
          }
          return null;
        })(j.tree ?? []);
        if (first) pick(first);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(path: string) {
    setSelected(path);
    setFile(null);
    setFileErr(null);
    const r = await fetch(`/api/sources/file?path=${encodeURIComponent(path)}`);
    const j = await r.json();
    if (!r.ok) setFileErr(j.error);
    else setFile(j);
  }

  async function copy() {
    if (!file) return;
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const lines = useMemo(() => (file ? file.content.split("\n") : []), [file]);

  return (
    <Shell active="sources" title="Deliverable Source Code">
      <div className="mb-5 rounded-xl border border-ink-700 bg-ink-850 px-5 py-4 text-[13px] text-ink-200 leading-relaxed">
        <span className="text-apex-400 font-semibold">What’s here:</span> the native Kotlin/Jetpack Compose client
        (<code className="font-mono text-[12px] text-ink-100">android-app/</code>), the GitHub Actions farm
        (<code className="font-mono text-[12px] text-ink-100">.github/workflows/</code>), the config injector
        (<code className="font-mono text-[12px] text-ink-100">scripts/configure_project.py</code>) and the base
        Capacitor/WebView wrapper (<code className="font-mono text-[12px] text-ink-100">capacitor-template/</code>). Push this repo
        as your farm repo and point Settings at it.
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4 items-start">
        <div className="rounded-xl border border-ink-700 bg-ink-850 p-2.5 max-h-[calc(100vh-230px)] overflow-y-auto">
          {loading ? (
            <div className="p-4 flex items-center gap-2 text-ink-300 text-sm">
              <Spinner size={14} /> loading tree…
            </div>
          ) : (
            <TreeNav nodes={tree} depth={0} onPick={pick} selected={selected} />
          )}
        </div>

        <div className="rounded-xl border border-ink-700 overflow-hidden min-h-[420px]">
          {file ? (
            <>
              <div className="flex items-center gap-3 px-4 py-2.5 bg-ink-800 border-b border-ink-700">
                <Icon name="filecode" size={14} className="text-apex-400" />
                <span className="font-mono text-[11.5px] text-ink-100 truncate">{file.path}</span>
                <span className="font-mono text-[10px] text-ink-400">{file.language} · {Math.round(file.size / 102.4) / 10} KB</span>
                <button
                  type="button"
                  onClick={copy}
                  className="ml-auto flex items-center gap-1.5 font-mono text-[10.5px] px-2 py-1 rounded border border-ink-600 text-ink-300 hover:text-apex-400 hover:border-apex-600/50 transition-colors cursor-pointer"
                >
                  <Icon name={copied ? "check" : "copy"} size={11} className={copied ? "text-apex-400" : ""} />
                  {copied ? "copied" : "copy"}
                </button>
              </div>
              <div className="bg-ink-950 p-4 font-mono text-[11.5px] leading-[1.7] overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
                {lines.map(renderLine)}
              </div>
            </>
          ) : (
            <div className="h-full grid place-items-center min-h-[420px]">
              <div className="text-center text-ink-400">
                <Icon name="filecode" size={34} className="mx-auto mb-3 opacity-40" />
                <div className="text-sm">{fileErr ?? (loading ? "Loading…" : "Select a file to inspect")}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
