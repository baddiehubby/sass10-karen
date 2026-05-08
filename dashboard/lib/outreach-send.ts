/**
 * Swap this implementation for Resend/SendGrid/etc. The dashboard currently persists rows only (demo mode).
 */
export async function sendOutreachEmail(_opts: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return { ok: true };
}
