import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { lemonRequest, getLemonStoreId, getLemonVariantIdByTier } from "@/lib/lemonsqueezy";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { tier?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const tier = (body.tier || "").toLowerCase();
  if (tier !== "pro" && tier !== "agency") return NextResponse.json({ error: "Invalid tier" }, { status: 400 });

  const storeId = getLemonStoreId();
  const variantId = getLemonVariantIdByTier(tier);
  if (!storeId || !variantId) {
    return NextResponse.json(
      { error: "Lemon Squeezy is not configured (LEMONSQUEEZY_STORE_ID / variant IDs)." },
      { status: 501 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });

  const base = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
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
            },
          },
          product_options: {
            redirect_url: `${base}/dashboard?lemonsqueezy=success`,
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
