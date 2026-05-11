import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { widgetConfigPostSchema } from "@/lib/validation";

function normalizeCss(input: string | undefined) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 4000);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, widgetConfigPostSchema);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data;
  const licenseKey = body.licenseKey.trim();
  const position = body.position ?? "bottom-right";
  const size = body.size ?? "medium";
  const themeMode = body.themeMode ?? "auto";

  let zIndex: number | null = null;
  if (body.zIndex !== undefined && body.zIndex !== null && String(body.zIndex).trim() !== "") {
    const parsedZ = Number(body.zIndex);
    if (!Number.isFinite(parsedZ)) return NextResponse.json({ error: "Invalid zIndex" }, { status: 400 });
    zIndex = Math.max(1, Math.min(2147483647, Math.round(parsedZ)));
  }

  const license = await prisma.license.findFirst({
    where: { key: licenseKey, userId: session.user.id },
    select: { id: true },
  });
  if (!license) return NextResponse.json({ error: "License not found" }, { status: 404 });

  const updated = await prisma.license.update({
    where: { id: license.id },
    data: {
      widgetTooltipText: body.tooltipText?.trim().slice(0, 140) || null,
      widgetPosition: position,
      widgetSize: size,
      widgetZIndex: zIndex,
      widgetCustomCss: normalizeCss(body.customCss ?? undefined),
      widgetThemeMode: themeMode,
    },
    select: {
      widgetTooltipText: true,
      widgetPosition: true,
      widgetSize: true,
      widgetZIndex: true,
      widgetCustomCss: true,
      widgetThemeMode: true,
    },
  });

  return NextResponse.json({ ok: true, config: updated });
}
