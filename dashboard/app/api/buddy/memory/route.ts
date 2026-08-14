import { NextResponse } from "next/server";
import { deleteMemory, discoverMemory, listMemories } from "@/lib/buddy-soul";
import { sessionUserId } from "@/lib/session-user";

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bond = await listMemories(userId);
  return NextResponse.json({ bond });
}

export async function POST() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bond = await discoverMemory(userId);
  return NextResponse.json({ bond });
}

export async function DELETE(req: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let memoryId = "";
  try {
    const body = (await req.json()) as { memoryId?: string };
    memoryId = typeof body.memoryId === "string" ? body.memoryId.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!memoryId || memoryId.length > 64) {
    return NextResponse.json({ error: "memoryId required" }, { status: 400 });
  }

  const bond = await deleteMemory(userId, memoryId);
  return NextResponse.json({ bond });
}
