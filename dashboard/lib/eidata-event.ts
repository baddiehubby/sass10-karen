import type { BroadRegion } from "@/lib/anonymized-mood-ingest";

/** Canonical anonymized mood event (no raw conversation text). */
export type AnonymizedMoodEventPayload = {
  /** Pseudonymous session id from the widget (`bdy_…`) or pre-hashed token from the client. */
  sessionToken: string;
  mood: "neutral" | "happy" | "thinking" | "concerned" | "excited" | "sleepy";
  /** ISO-8601 UTC timestamp */
  timestamp?: string;
  /** Broad geographic bucket only — never country/city precision from the client. */
  region?: BroadRegion;
  companionType?: "buddy" | "sachapandit";
  source?: "chatgpt" | "claude" | "gemini" | "website" | "extension" | "unknown";
  /** Optional — server derives pseudonymous token from license when provided. */
  licenseKey?: string;
};

/** Example payload for docs and integration tests */
export const ANONYMIZED_MOOD_EVENT_EXAMPLE: AnonymizedMoodEventPayload = {
  sessionToken: "bdy_a1b2c3d4",
  mood: "happy",
  timestamp: "2026-05-27T14:30:00.000Z",
  region: "EU",
  companionType: "buddy",
  source: "chatgpt",
};
