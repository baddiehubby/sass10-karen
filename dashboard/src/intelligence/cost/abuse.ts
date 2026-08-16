/**
 * Abuse protection for intelligence resolution.
 * Local compute is cheap but not free — bound per-user / IP consumption.
 */

export type AbuseCheckInput = {
  userId?: string | null;
  clientIp?: string | null;
  text: string;
  conversationDepth?: number;
  recentTurnCount?: number;
  /** Consecutive retries for the same external attempt. */
  externalRetryCount?: number;
};

export type AbuseDecision =
  | { ok: true }
  | {
      ok: false;
      code: "rate_user" | "rate_ip" | "request_size" | "conversation_length" | "retry_limit" | "circuit_open";
      softMessage: string;
    };

const USER_LIMIT = 90; // / minute — local path; still bounds CPU abuse
const IP_LIMIT = 180; // / minute
const WINDOW_MS = 60_000;
const MAX_TEXT = 800;
const MAX_DEPTH = 40;
const MAX_TURNS = 80;
const MAX_EXTERNAL_RETRIES = 2;
const PROVIDER_TIMEOUT_MS = 4_000;
const CIRCUIT_FAIL_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 60_000;

type WindowCounter = { count: number; resetAt: number };
const userWindows = new Map<string, WindowCounter>();
const ipWindows = new Map<string, WindowCounter>();

let circuitOpenUntil = 0;
let consecutiveProviderFailures = 0;

function bump(map: Map<string, WindowCounter>, key: string, limit: number): boolean {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur || now >= cur.resetAt) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

export function checkIntelligenceAbuse(input: AbuseCheckInput): AbuseDecision {
  const text = input.text ?? "";
  if (text.length > MAX_TEXT) {
    return {
      ok: false,
      code: "request_size",
      softMessage: "That was a lot — try a shorter thought.",
    };
  }

  const depth = input.conversationDepth ?? 1;
  const turns = input.recentTurnCount ?? 0;
  if (depth > MAX_DEPTH || turns > MAX_TURNS) {
    return {
      ok: false,
      code: "conversation_length",
      softMessage: "Let's take a soft pause — start a fresh thread when you're ready.",
    };
  }

  if ((input.externalRetryCount ?? 0) > MAX_EXTERNAL_RETRIES) {
    return {
      ok: false,
      code: "retry_limit",
      softMessage: "I'm still with you — give me a moment and try again.",
    };
  }

  if (Date.now() < circuitOpenUntil) {
    return {
      ok: false,
      code: "circuit_open",
      softMessage: "I'm right here — responding in our usual soft way.",
    };
  }

  const userKey = (input.userId || "anon").slice(0, 80);
  if (!bump(userWindows, userKey, USER_LIMIT)) {
    return {
      ok: false,
      code: "rate_user",
      softMessage: "I'm listening — one moment.",
    };
  }

  const ip = (input.clientIp || "").trim();
  if (ip && !bump(ipWindows, ip.slice(0, 64), IP_LIMIT)) {
    return {
      ok: false,
      code: "rate_ip",
      softMessage: "I'm listening — one moment.",
    };
  }

  return { ok: true };
}

export function getProviderTimeoutMs(): number {
  return PROVIDER_TIMEOUT_MS;
}

export function recordProviderSuccess(): void {
  consecutiveProviderFailures = 0;
  circuitOpenUntil = 0;
}

export function recordProviderFailure(): void {
  consecutiveProviderFailures += 1;
  if (consecutiveProviderFailures >= CIRCUIT_FAIL_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    consecutiveProviderFailures = 0;
  }
}

export function isProviderCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

/** Test helper */
export function resetAbuseState(): void {
  userWindows.clear();
  ipWindows.clear();
  circuitOpenUntil = 0;
  consecutiveProviderFailures = 0;
}

export const ABUSE_LIMITS = {
  USER_LIMIT,
  IP_LIMIT,
  WINDOW_MS,
  MAX_TEXT,
  MAX_DEPTH,
  MAX_TURNS,
  MAX_EXTERNAL_RETRIES,
  PROVIDER_TIMEOUT_MS,
} as const;
