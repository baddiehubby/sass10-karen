import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api-json";
import { getUserEntitlement } from "@/lib/billing/entitlement";
import {
  buildCompanionReaction,
  hasPaidCompanionReactionAccess,
  presenceMoodFromReaction,
} from "@/lib/companion-reaction.server";
import { buildCompanionSyncPayload } from "@/lib/companion-sync";
import { BUDDY_MOODS } from "@/lib/companion-mood";
import { validateRequestOrigin } from "@/lib/mobile-auth";
import { patchPresenceMood } from "@/lib/presence-service";
import { sessionUserId } from "@/lib/session-user";
import { getCanonicalSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const reactionSchema = z.union([
  z.object({
    source: z.literal("explicit_mood"),
    mood: z.enum(BUDDY_MOODS),
  }).strict(),
  z.object({
    source: z.literal("media"),
    text: z.string().max(280).optional(),
    title: z.string().max(280).optional(),
  }).strict().refine((value) => Boolean(value.text?.trim() || value.title?.trim()), {
    message: "Shared media context is required",
  }),
]);

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  if (!validateRequestOrigin(req.headers.get("origin"), getCanonicalSiteUrl())) {
    return noStore({ error: "Invalid request origin" }, 403);
  }
  const userId = await sessionUserId();
  if (!userId) return noStore({ error: "Unauthorized" }, 401);

  const parsed = await parseJsonBody(req, reactionSchema);
  if (!parsed.ok) return parsed.response;

  // Entitlement is checked before companion generation or presence mutation.
  const entitlement = await getUserEntitlement(userId);
  if (!hasPaidCompanionReactionAccess(entitlement)) {
    return noStore({ error: "Paid companion access is required" }, 403);
  }
  const companion = await buildCompanionSyncPayload(userId);
  if (!companion) return noStore({ error: "No active companion license" }, 403);

  const reaction = buildCompanionReaction(parsed.data, {
    companionName: companion.companionName,
    seed: `web-reaction:${userId}:${parsed.data.source}`,
  });
  if (parsed.data.source === "explicit_mood") {
    await patchPresenceMood(
      companion.licenseKey,
      presenceMoodFromReaction(parsed.data.mood),
    );
  }
  return noStore({ reaction });
}
