/**
 * Structured server logging — JSON lines only.
 * NEVER log passwords, OAuth secrets, API keys, webhook secrets,
 * session tokens, full Authorization headers, payment secrets,
 * or private user content.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type SafeLogFields = {
  level?: LogLevel;
  msg: string;
  event?: string;
  requestId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  errorCode?: string;
  reason?: string;
  /** Lemon / billing event id only — never raw payload. */
  lemonEventId?: string;
  billingAction?: string;
  /** Opaque outcome codes only. */
  outcome?: string;
};

const FORBIDDEN_KEY =
  /password|passwd|secret|api[_-]?key|authorization|cookie|token|session|webhook.?secret|private.?key|license.?key|credit.?card|cvv|ssn/i;

export function scrubLogValue(key: string, value: unknown): unknown {
  if (FORBIDDEN_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") {
    if (value.length > 500) return `${value.slice(0, 120)}…[truncated]`;
    if (/^Bearer\s+/i.test(value)) return "Bearer [redacted]";
    if (/^sk[-_]|whsec_|AQ\./i.test(value)) return "[redacted]";
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubLogValue(k, v);
    }
    return out;
  }
  return value;
}

export function buildLogLine(fields: SafeLogFields): string {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level: fields.level ?? "info",
    msg: fields.msg,
  };
  for (const [k, v] of Object.entries(fields)) {
    if (k === "msg" || k === "level" || v === undefined) continue;
    payload[k] = scrubLogValue(k, v);
  }
  return JSON.stringify(payload);
}

export function logStructured(fields: SafeLogFields): void {
  const line = buildLogLine(fields);
  const level = fields.level ?? "info";
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logAuthFailure(input: {
  requestId?: string;
  reason: "bad_credentials" | "rate_limited" | "oauth_unverified" | "oauth_provision_failed" | "invalid_body";
}): void {
  logStructured({
    level: "warn",
    msg: "authentication failure",
    event: "auth.failure",
    requestId: input.requestId,
    reason: input.reason,
    route: "/api/auth",
  });
}

export function logBillingAudit(input: {
  requestId?: string;
  lemonEventId: string;
  eventName: string;
  action: string;
  outcome: string;
}): void {
  logStructured({
    level: "info",
    msg: "billing audit",
    event: "billing.audit",
    requestId: input.requestId,
    lemonEventId: input.lemonEventId,
    billingAction: input.action,
    reason: input.eventName,
    outcome: input.outcome,
  });
}

export function logHttpTiming(input: {
  requestId?: string;
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
}): void {
  logStructured({
    level: input.durationMs >= 2000 ? "warn" : "info",
    msg: "http request",
    event: "http.request",
    requestId: input.requestId,
    route: input.route,
    method: input.method,
    statusCode: input.statusCode,
    durationMs: Math.round(input.durationMs),
  });
}

export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.name || "Error";
  return "unknown_error";
}
