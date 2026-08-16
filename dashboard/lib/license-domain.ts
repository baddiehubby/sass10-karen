/**
 * License domain binding — prefer Origin/Referer over client-claimed domain.
 */

export function hostnameFromHeaderValue(raw: string | null | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "";
  try {
    if (/^https?:\/\//i.test(s)) {
      return new URL(s).hostname.toLowerCase();
    }
    // Origin-style: https://host:port or bare host
    if (s.includes("://")) {
      return new URL(s).hostname.toLowerCase();
    }
    return s.replace(/:\d+$/, "").split("/")[0]!.toLowerCase();
  } catch {
    return s.replace(/:\d+$/, "").split("/")[0]!.toLowerCase();
  }
}

/**
 * Domain presented by the request. Origin/Referer win; client claim is last-resort
 * for non-browser agents and must still match a bound license.
 */
export function resolvePresentedDomain(
  req: { headers: { get(name: string): string | null } },
  clientClaimed?: string | null,
): string {
  const fromOrigin = hostnameFromHeaderValue(req.headers.get("origin"));
  if (fromOrigin) return fromOrigin;
  const fromReferer = hostnameFromHeaderValue(req.headers.get("referer"));
  if (fromReferer) return fromReferer;
  return hostnameFromHeaderValue(clientClaimed);
}

function hostsMatch(bound: string, presented: string): boolean {
  if (!bound || !presented) return false;
  if (bound === presented) return true;
  // Allow www.bound ↔ bound
  if (bound.startsWith("www.") && bound.slice(4) === presented) return true;
  if (presented.startsWith("www.") && presented.slice(4) === bound) return true;
  return false;
}

export function assertLicenseDomain(
  licenseDomain: string | null | undefined,
  requestDomain: string | null | undefined,
): { ok: true } | { ok: false; reason: "domain_required" | "domain_mismatch" } {
  const bound = (licenseDomain || "").trim().toLowerCase();
  if (!bound) return { ok: true };
  const presented = (requestDomain || "").trim().toLowerCase();
  if (!presented) return { ok: false, reason: "domain_required" };
  if (!hostsMatch(bound, presented)) return { ok: false, reason: "domain_mismatch" };
  return { ok: true };
}

/** Fail closed for bound licenses when no Origin/Referer/claim can be verified. */
export function assertLicenseDomainFromRequest(
  licenseDomain: string | null | undefined,
  req: { headers: { get(name: string): string | null } },
  clientClaimed?: string | null,
): { ok: true; presented: string } | { ok: false; reason: "domain_required" | "domain_mismatch" } {
  const presented = resolvePresentedDomain(req, clientClaimed);
  const check = assertLicenseDomain(licenseDomain, presented);
  if (!check.ok) return check;
  return { ok: true, presented };
}

/** Strip dangerous CSS constructs from owner-supplied widget CSS. */
export function sanitizeWidgetCss(input: string | null | undefined, maxLen = 6000): string {
  if (!input) return "";
  let s = String(input).slice(0, maxLen);
  s = s.replace(/<\/?[^>]+>/g, "");
  s = s.replace(/@import[\s\S]*?;/gi, "");
  s = s.replace(/expression\s*\(/gi, "");
  s = s.replace(/javascript\s*:/gi, "");
  s = s.replace(/vbscript\s*:/gi, "");
  s = s.replace(/behavior\s*:/gi, "");
  s = s.replace(/-moz-binding\s*:/gi, "");
  s = s.replace(/url\s*\(\s*['"]?\s*data:/gi, "url(");
  return s.trim();
}
