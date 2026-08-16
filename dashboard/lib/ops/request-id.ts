/**
 * Request correlation IDs — echo inbound x-request-id or mint a new one.
 */

const REQUEST_ID_HEADER = "x-request-id";

export function resolveRequestId(headers: { get(name: string): string | null }): string {
  const inbound = (headers.get(REQUEST_ID_HEADER) || headers.get("x-correlation-id") || "").trim();
  if (inbound && /^[A-Za-z0-9._-]{8,128}$/.test(inbound)) return inbound;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function requestIdHeaderName(): string {
  return REQUEST_ID_HEADER;
}

export function getRequestIdFromRequest(req: Request): string {
  return resolveRequestId(req.headers);
}
