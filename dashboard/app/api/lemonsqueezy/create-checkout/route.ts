import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { getLemonCheckoutRedirectUrls } from "@/lib/lemon-checkout-urls";
import {
  getLemonVariantIdByTier,
  lemonRequest,
  missingVariantEnvForTier,
  resolveLemonStoreId,
} from "@/lib/lemonsqueezy";
import { isPaidCheckoutTier } from "@/lib/pricing-plans";
import { prisma } from "@/lib/prisma";
import { lemonCheckoutBodySchema } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, lemonCheckoutBodySchema);
  if (!parsed.ok) return parsed.response;

  const { tier, trial } = parsed.data;
  if (!isPaidCheckoutTier(tier)) {
    return NextResponse.json(
      { error: "Choose Starter, Pro, or Premium to continue checkout." },
      { status: 400 },
    );
  }

  const variantId = getLemonVariantIdByTier(tier, { trial });
  const storeId = await resolveLemonStoreId();
  // #region agent log
  fetch("http://127.0.0.1:7611/ingest/87ee683e-41c7-4485-9b1b-9c00188d4aac", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f590a1" },
    body: JSON.stringify({
      sessionId: "f590a1",
      hypothesisId: "E",
      location: "create-checkout/route.ts:resolve",
      message: "checkout variant resolution",
      data: { tier, hasVariantId: Boolean(variantId), hasStoreId: Boolean(storeId) },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (!variantId || !storeId) {
    const missing = !variantId ? missingVariantEnvForTier(tier) : "LEMONSQUEEZY_STORE_ID / API key";
    return NextResponse.json(
      {
        error: `Checkout is not connected yet (${missing}). Create the Lemon Squeezy product for this tier and set the variant ID in Vercel.`,
      },
      { status: 501 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });

  const urls = getLemonCheckoutRedirectUrls(tier);

  const response = await lemonRequest("/checkouts", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: user?.email || undefined,
            name: user?.name || undefined,
            custom: {
              user_id: session.user.id,
              tier,
              trial: trial ? "true" : "false",
              cancel_return_url: urls.cancelUrl,
            },
          },
          product_options: {
            redirect_url: urls.successUrl,
            receipt_link_url: urls.receiptUrl,
            receipt_button_text: "Open your Buddy dashboard",
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    }),
  });

  const payload = (await response.json()) as {
    data?: { attributes?: { url?: string } };
    errors?: Array<{ detail?: string }>;
  };

  if (!response.ok) {
    return NextResponse.json(
      { error: payload.errors?.[0]?.detail || "Failed to create Lemon Squeezy checkout" },
      { status: 502 },
    );
  }

  const url = payload.data?.attributes?.url;
  if (!url) return NextResponse.json({ error: "Checkout URL missing from Lemon Squeezy" }, { status: 502 });

  return NextResponse.json({ url });
}
