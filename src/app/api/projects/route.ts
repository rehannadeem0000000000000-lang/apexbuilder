import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { projects, type AppConfig } from "@/db/schema";

const DATA_DIR = join(process.cwd(), "data");

export async function GET() {
  const rows = await db.select().from(projects).orderBy(desc(projects.createdAt)).limit(200);
  return NextResponse.json({ projects: rows });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const sourceType = form.get("sourceType") === "website" ? "website" : "upload";
  const fileType = sourceType === "website" ? "url" : form.get("fileType") === "zip" ? "zip" : "html";
  const platform = form.get("platform") === "aab" ? "aab" : "apk";
  const configRaw = String(form.get("config") ?? "{}");
  const url = String(form.get("url") ?? "").trim() || null;

  let config: AppConfig;
  try {
    config = JSON.parse(configRaw);
  } catch {
    return NextResponse.json({ error: "Invalid config JSON" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "App name is required" }, { status: 400 });
  if (!config.packageSuffix) return NextResponse.json({ error: "Package suffix is required" }, { status: 400 });
  if (sourceType === "website" && !url) return NextResponse.json({ error: "Website URL is required" }, { status: 400 });
  config.url = sourceType === "website" ? url : null;

  const id = randomUUID();
  let fileName: string | null = null;
  let fileSize: number | null = null;
  let filePath: string | null = null;

  const file = form.get("file");
  if (sourceType === "upload") {
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Source file is required for upload builds" }, { status: 400 });
    }
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds the 200 MB upload limit" }, { status: 400 });
    }
    const safeName = file.name.replace(/[^\w.\-]/g, "_").slice(-80);
    const dir = join(DATA_DIR, "uploads");
    mkdirSync(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    const path = join(dir, `${id}.${fileType === "zip" ? "zip" : "html"}`);
    writeFileSync(path, buf);
    fileName = safeName;
    fileSize = file.size;
    filePath = path;
  }

  const now = new Date();
  await db.insert(projects).values({
    id,
    name,
    sourceType,
    fileType,
    fileName,
    fileSize,
    filePath,
    platform,
    config,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id }, { status: 201 });
}
