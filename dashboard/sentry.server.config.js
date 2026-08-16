import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENSITIVE =
  /password|passwd|secret|authorization|cookie|api[_-]?key|token|session|webhook|license.?key|bearer/i;

function scrubDeep(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) scrubDeep(item);
    return;
  }
  for (const key of Object.keys(node)) {
    if (SENSITIVE.test(key)) {
      node[key] = "[redacted]";
      continue;
    }
    scrubDeep(node[key]);
  }
}

function scrubSentryEvent(event) {
  try {
    const clone = JSON.parse(JSON.stringify(event));
    scrubDeep(clone);
    if (clone.request && typeof clone.request === "object") {
      if (clone.request.headers && typeof clone.request.headers === "object") {
        for (const key of Object.keys(clone.request.headers)) {
          if (SENSITIVE.test(key)) clone.request.headers[key] = "[redacted]";
        }
        delete clone.request.headers.cookie;
        delete clone.request.headers.authorization;
        delete clone.request.headers.Authorization;
      }
      delete clone.request.cookies;
      delete clone.request.data;
      delete clone.request.query_string;
    }
    return clone;
  } catch {
    return null;
  }
}

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}
