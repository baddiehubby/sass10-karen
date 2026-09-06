import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api-json";
import {
  listOwnedMobileDevices,
  revokeOwnedMobileDevice,
} from "@/lib/mobile-auth-store";
import { validateRequestOrigin } from "@/lib/mobile-auth";
import { sessionUserId } from "@/lib/session-user";
import { getCanonicalSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const revokeSchema = z.object({
  deviceId: z.string().uuid(),
}).strict();

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return noStore({ error: "Unauthorized" }, 401);

  const devices = await listOwnedMobileDevices(userId);
  return noStore({
    devices: devices.map((device) => ({
      id: device.id,
      platform: device.platform,
      displayName: device.displayName,
      appVersion: device.appVersion,
      status: device.revokedAt ? "revoked" : "active",
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      createdAt: device.createdAt.toISOString(),
      revokedAt: device.revokedAt?.toISOString() ?? null,
    })),
  });
}

async function revoke(req: Request) {
  if (!validateRequestOrigin(req.headers.get("origin"), getCanonicalSiteUrl())) {
    return noStore({ error: "Invalid request origin" }, 403);
  }
  const userId = await sessionUserId();
  if (!userId) return noStore({ error: "Unauthorized" }, 401);

  const parsed = await parseJsonBody(req, revokeSchema);
  if (!parsed.ok) return parsed.response;
  const revoked = await revokeOwnedMobileDevice({
    userId,
    deviceId: parsed.data.deviceId,
  });
  return revoked
    ? noStore({ ok: true })
    : noStore({ error: "Device not found or already revoked" }, 404);
}

export async function DELETE(req: Request) {
  return revoke(req);
}

export async function POST(req: Request) {
  return revoke(req);
}
