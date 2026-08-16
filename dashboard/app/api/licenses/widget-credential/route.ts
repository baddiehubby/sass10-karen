/**
 * Exchange a license key (or session ownership) for a short-lived scoped widget credential.
 * Never returns the raw license key. Tokens expire; rotating the license key invalidates kfp.
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { isLicenseActive } from "@/lib/free-license";
import { assertLicenseDomainFromRequest } from "@/lib/license-domain";
import { prisma } from "@/lib/prisma";
import {
  WIDGET_CREDENTIAL_TTL_SEC,
  WIDGET_SCOPES,
  mintWidgetCredential,
  type WidgetScope,
} from "@/lib/widget-credential";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    licenseKey: z.string().min(8).max(120).optional(),
    licenseId: z.string().min(1).max(80).optional(),
    scopes: z.array(z.enum(WIDGET_SCOPES)).max(8).optional(),
    ttlSec: z.coerce.number().min(60).max(3600).optional(),
  })
  .strict()
  .refine((d) => Boolean((d.licenseKey || "").trim() || (d.licenseId || "").trim()), {
    message: "licenseKey or licenseId required",
  });

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Buddy-License-Key",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) {
    const r = parsed.response;
    for (const [k, v] of Object.entries(corsHeaders())) r.headers.set(k, v);
    return r;
  }

  const licenseKey = (parsed.data.licenseKey || "").trim();
  const licenseId = (parsed.data.licenseId || "").trim();
  const session = await getServerSession(authOptions);

  const license = licenseKey
    ? await prisma.license.findUnique({
        where: { key: licenseKey },
        select: {
          id: true,
          key: true,
          userId: true,
          domain: true,
          expiresAt: true,
          plan: true,
          lemonSqueezySubscriptionStatus: true,
        },
      })
    : await prisma.license.findFirst({
        where: { id: licenseId },
        select: {
          id: true,
          key: true,
          userId: true,
          domain: true,
          expiresAt: true,
          plan: true,
          lemonSqueezySubscriptionStatus: true,
        },
      });

  if (!license || !isLicenseActive(license)) {
    return NextResponse.json({ error: "Invalid license" }, { status: 403, headers: corsHeaders() });
  }

  const ownsSession = Boolean(session?.user?.id && session.user.id === license.userId);
  const presentedKey =
    licenseKey ||
    req.headers.get("x-buddy-license-key")?.trim() ||
    "";

  if (!ownsSession) {
    if (!presentedKey || presentedKey !== license.key) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders() });
    }
    const domainCheck = assertLicenseDomainFromRequest(license.domain, req);
    // Unbound keys may still exchange (bootstrap), but resulting token is short-lived.
    if (license.domain && !domainCheck.ok) {
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403, headers: corsHeaders() });
    }
  }

  const requested = parsed.data.scopes?.length
    ? (parsed.data.scopes as WidgetScope[])
    : (["mood:write", "presence:write", "analytics:write", "theme:read"] as WidgetScope[]);

  try {
    const minted = await mintWidgetCredential({
      licenseId: license.id,
      licenseKey: license.key,
      scopes: requested,
      ttlSec: parsed.data.ttlSec ?? WIDGET_CREDENTIAL_TTL_SEC,
    });
    return NextResponse.json(
      {
        ok: true,
        token: minted.token,
        expiresAt: minted.expiresAt,
        scopes: minted.scopes,
        tokenType: "Bearer",
      },
      { headers: corsHeaders() },
    );
  } catch {
    return NextResponse.json({ error: "Unable to mint credential" }, { status: 500, headers: corsHeaders() });
  }
}
