import { NextResponse } from "next/server";
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOTS = ["android-app", "capacitor-template", ".github/workflows", "scripts", "README.md"];

interface Node {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: Node[];
  size?: number;
}

function walk(abs: string): Node[] {
  const entries = readdirSync(abs, { withFileTypes: true }).sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const out: Node[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".github") continue;
    const p = join(abs, e.name);
    if (e.isDirectory()) {
      out.push({ name: e.name, path: relative(process.cwd(), p), type: "dir", children: walk(p) });
    } else {
      const st = statSync(p);
      out.push({ name: e.name, path: relative(process.cwd(), p), type: "file", size: st.size });
    }
  }
  return out;
}

export async function GET() {
  const roots: Node[] = [];
  for (const r of ROOTS) {
    const abs = join(process.cwd(), r);
    try {
      const st = statSync(abs);
      if (st.isDirectory()) {
        roots.push({ name: r, path: r, type: "dir", children: walk(abs) });
      } else {
        roots.push({ name: r, path: r, type: "file", size: st.size });
      }
    } catch {}
  }
  return NextResponse.json({ tree: roots });
}
