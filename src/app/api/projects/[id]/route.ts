import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { rmSync } from "fs";
import { db } from "@/db";
import { projects } from "@/db/schema";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!rows.length) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ project: rows[0] });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!rows.length) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const row = rows[0];
  if (row.filePath) {
    try {
      rmSync(row.filePath, { force: true });
    } catch {}
  }
  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ ok: true });
}
