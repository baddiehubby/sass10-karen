/**
 * License domain binding — if a license has a bound domain, requests must present it.
 */

export function assertLicenseDomain(
  licenseDomain: string | null | undefined,
  requestDomain: string | null | undefined,
): { ok: true } | { ok: false; reason: "domain_required" | "domain_mismatch" } {
  const bound = (licenseDomain || "").trim().toLowerCase();
  if (!bound) return { ok: true };
  const presented = (requestDomain || "").trim().toLowerCase();
  if (!presented) return { ok: false, reason: "domain_required" };
  if (presented !== bound) return { ok: false, reason: "domain_mismatch" };
  return { ok: true };
}
