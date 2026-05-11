import { NextResponse } from "next/server";
import type { z } from "zod";

export async function parseJsonBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  const text = await req.text();
  if (!text.trim()) {
    raw = {};
  } else {
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
    }
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Expected a JSON object" }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}
