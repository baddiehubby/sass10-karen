import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api-json";
import { createKarenUnlockCheckout } from "@/app/karen/actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  guestId: z.string().trim().min(8).max(80).optional(),
});

/**
 * POST /api/karen/checkout
 * Creates a Lemon Squeezy one-time ($2.99) checkout for the Karen Roast report.
 */
export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const result = await createKarenUnlockCheckout({
    guestId: parsed.data.guestId,
  });

  if (!result.ok) {
    const status = /not configured|Missing guest/i.test(result.error) ? 501 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ url: result.url, purchaseType: "one_time", price: 2.99 });
}
