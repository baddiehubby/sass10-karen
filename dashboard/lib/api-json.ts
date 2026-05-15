import { NextResponse } from "next/server";
import type { z } from "zod";

export async function parseJsonBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  const text = await req.text();
  if (!text.trim()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Request body is required" }, { status: 400 }),
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
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
      response: NextResponse.json(parsed.error.flatten(), { status: 400 }),
    };
  }
  return { ok: true, data: parsed.data };
}

export function parseQuery<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse } {
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(parsed.error.flatten(), { status: 400 }),
    };
  }
  return { ok: true, data: parsed.data };
}
