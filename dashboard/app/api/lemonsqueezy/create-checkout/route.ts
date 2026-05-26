import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { lemonRequest, getLemonVariantIdByTier, resolveLemonStoreId } from "@/lib/lemonsqueezy";
import { isPaidCheckoutTier } from "@/lib/pricing-plans";
import { prisma } from "@/lib/prisma";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import { lemonCheckoutBodySchema } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, lemonCheckoutBodySchema);
  if (!parsed.ok) return parsed.response;

  const { tier, trial } = parsed.data;
  if (!isPaidCheckoutTier(tier)) {
    return NextResponse.json(
      {
        error:
          "Buddy Free does not use checkout. Sign in with Google — your free license is created automatically.",
      },
      { status: 400 },
    );
  }

  const variantId = getLemonVariantIdByTier(tier, { trial });
  const storeId = await resolveLemonStoreId();
  if (!variantId || !storeId) {
    const missing =
      tier === "pro" ? "LEMONSQUEEZY_PRO_VARIANT_ID" : "LEMONSQUEEZY_AGENCY_VARIANT_ID";
    return NextResponse.json(
      {
        error: `Lemon Squeezy is not configured (${missing}, LEMONSQUEEZY_API_KEY).`,
      },
      { status: 501 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });

  const base = getCanonicalSiteUrl();
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
            },
          },
          product_options: {
            redirect_url: `${base}/dashboard?payment=success`,
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
