import { NextResponse } from "next/server";
import { z } from "zod";
import { touchSoul, type SoulInteraction } from "@/lib/buddy-soul";
import { sessionUserId } from "@/lib/session-user";

const bodySchema = z.object({
  interaction: z.enum([
    "mood_shared",
    "oracle_consulted",
    "ritual_completed",
    "memory_discovered",
    "returned_home",
  ]),
  mood: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const bond = await touchSoul(userId, parsed.data.interaction as SoulInteraction, parsed.data.mood);
  return NextResponse.json({ bond });
}
