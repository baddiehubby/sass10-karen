import { NextResponse } from "next/server";
import { parseQuery } from "@/lib/api-json";
import { prisma } from "@/lib/prisma";
import { normalizeCompanionType, resolveTenantPersona } from "@/lib/tenant";
import { licenseVerifyQuerySchema } from "@/lib/validation";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

const ALLOWED_MOODS = new Set(["neutral", "happy", "thinking", "concerned", "excited", "sleepy", "angry", "zen", "lit", "divine"]);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  const parsed = parseQuery(req, licenseVerifyQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { key, domain } = parsed.data;

  const license = await prisma.license.findUnique({ where: { key } });
  if (!license) {
    return NextResponse.json(
      { valid: false, reason: "License not found", features: null },
      { headers: corsHeaders() },
    );
  }

  if (license.plan.trim().toLowerCase() !== "free" && license.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { valid: false, reason: "License expired", features: null },
      { headers: corsHeaders() },
    );
  }

  if (license.domain && domain && license.domain !== domain) {
    return NextResponse.json(
      { valid: false, reason: "Domain not allowed", features: null },
      { headers: corsHeaders() },
    );
  }

  let parsedFeatures: Record<string, unknown> = {};
  try {
    parsedFeatures = JSON.parse(license.features) as Record<string, unknown>;
  } catch {
    parsedFeatures = {};
  }
  const companionType = normalizeCompanionType(parsedFeatures.companionType);
  const tenantPersona = resolveTenantPersona(companionType);

  return NextResponse.json(
    {
      valid: true,
      licenseId: license.id,
      plan: license.plan,
      features: parsedFeatures,
      companionType,
      tenantPersona,
      expiresAt: license.expiresAt,
      whiteLabel: Boolean(parsedFeatures.whiteLabel),
      widgetConfig: {
        tooltipText: license.widgetTooltipText,
        position: license.widgetPosition,
        size: license.widgetSize,
        zIndex: license.widgetZIndex,
        customCss: license.widgetCustomCss,
        themeMode: license.widgetThemeMode,
      },
      moodOverride:
        license.forcedMood &&
        license.forcedMoodUntil &&
        license.forcedMoodUntil.getTime() > Date.now() &&
        ALLOWED_MOODS.has(license.forcedMood)
          ? license.forcedMood
          : null,
    },
    { headers: corsHeaders() },
  );
}
