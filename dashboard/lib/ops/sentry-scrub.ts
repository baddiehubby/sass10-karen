/**
 * Sentry redaction — never send secrets, tokens, or private content.
 */

const SENSITIVE =
  /password|passwd|secret|authorization|cookie|api[_-]?key|token|session|webhook|license.?key|bearer/i;

export function scrubSentryEvent<T extends Record<string, unknown>>(event: T): T | null {
  try {
    const clone = structuredClone(event) as Record<string, unknown>;
    scrubDeep(clone);
    if (clone.request && typeof clone.request === "object") {
      const req = clone.request as Record<string, unknown>;
      if (req.headers && typeof req.headers === "object") {
        const headers = { ...(req.headers as Record<string, unknown>) };
        for (const key of Object.keys(headers)) {
          if (SENSITIVE.test(key)) headers[key] = "[redacted]";
        }
        req.headers = headers;
      }
      delete req.cookies;
      delete req.data;
      delete req.query_string;
    }
    return clone as T;
  } catch {
    return null;
  }
}

function scrubDeep(node: unknown): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) scrubDeep(item);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (SENSITIVE.test(key)) {
      obj[key] = "[redacted]";
      continue;
    }
    scrubDeep(obj[key]);
  }
}
