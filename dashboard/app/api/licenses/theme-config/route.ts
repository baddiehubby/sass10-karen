import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { parseQuery } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { licenseThemeConfigQuerySchema } from "@/lib/validation";

/** Authenticated: read saved theme preset + hex overrides for the theme editor UI. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseQuery(req, licenseThemeConfigQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { licenseKey } = parsed.data;

  const license = await prisma.license.findFirst({
    where: { key: licenseKey, userId: session.user.id },
    select: {
      themePreset: true,
      themeAccentHex: true,
      themeDeepHex: true,
      themeImageUrl: true,
    },
  });
  if (!license) {
    return NextResponse.json({ error: "License not found" }, { status: 404 });
  }

  return NextResponse.json({
    preset: license.themePreset,
    accentHex: license.themeAccentHex || "",
    deepHex: license.themeDeepHex || "",
    hasImage: Boolean(license.themeImageUrl),
  });
}
