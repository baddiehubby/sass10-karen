import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-json";
import { logAuthFailure } from "@/lib/ops/logger";
import { getRequestIdFromRequest } from "@/lib/ops/request-id";
import { observeApiRoute } from "@/lib/ops/api-telemetry";
import { prisma } from "@/lib/prisma";
import { loginBodySchema } from "@/lib/validation";

/** Dummy hash so unknown emails still pay bcrypt cost (timing oracle mitigation). */
const DUMMY_HASH = bcrypt.hashSync("buddie-login-timing-pad", 10);

/**
 * Credential probe only — does NOT create a session.
 * Prefer NextAuth `signIn("credentials")` for real login.
 * Never returns user ids or distinguishes missing vs bad password beyond 401.
 */
export async function POST(req: Request) {
  return observeApiRoute(req, "/api/auth/login", async () => {
    const requestId = getRequestIdFromRequest(req);
    const parsed = await parseJsonBody(req, loginBodySchema);
    if (!parsed.ok) {
      logAuthFailure({ requestId, reason: "invalid_body" });
      return parsed.response;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email }, select: { password: true } });
    const hash = user?.password || DUMMY_HASH;
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok) {
      logAuthFailure({ requestId, reason: "bad_credentials" });
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      note: "Use NextAuth credentials signIn for session cookies.",
    });
  });
}
