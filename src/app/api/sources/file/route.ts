import { NextRequest, NextResponse } from "next/server";
import { readFileSync, statSync } from "fs";
import { isAbsolute, join, resolve } from "path";

const ALLOWED_PREFIXES = ["android-app/", "capacitor-template/", ".github/", "scripts/", "README.md"];

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (isAbsolute(path) || !ALLOWED_PREFIXES.some((p) => path === p.slice(0, -1) || path.startsWith(p))) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 400 });
  }
  const abs = resolve(join(process.cwd(), path));
  try {
    const st = statSync(abs);
    if (st.isDirectory() || st.size > 400 * 1024) {
      return NextResponse.json({ error: "File is a directory or too large to preview" }, { status: 400 });
    }
    const content = readFileSync(abs, "utf8");
    const ext = path.split(".").pop() ?? "";
    const language =
      ext === "kt" || ext === "kts" ? "kotlin"
      : ext === "java" ? "java"
      : ext === "xml" ? "xml"
      : ext === "yml" || ext === "yaml" ? "yaml"
      : ext === "py" ? "python"
      : ext === "json" ? "json"
      : ext === "html" ? "html"
      : ext === "js" ? "javascript"
      : "text";
    return NextResponse.json({ path, content, size: st.size, language });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
