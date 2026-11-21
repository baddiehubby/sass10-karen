/**
 * Karen growth analytics — Vercel Analytics + Meta Pixel + TikTok Pixel.
 * Event names match ad-platform custom conversions.
 */

import { track as vercelTrack } from "@vercel/analytics";

export type KarenTrackEvent = "Fight_Started" | "Paywall_Hit" | (string & {});

type TrackProps = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: {
      track: (event: string, props?: Record<string, unknown>) => void;
      page?: () => void;
      load?: (id: string) => void;
    };
    __karenFightStarted?: boolean;
    __karenPaywallHit?: boolean;
  }
}

/** Fire once-per-session Fight_Started (first mic press). */
export function trackFightStarted(): void {
  if (typeof window === "undefined") return;
  if (window.__karenFightStarted) return;
  window.__karenFightStarted = true;
  track("Fight_Started");
}

/** Fire once-per-session Paywall_Hit (free quota / cliffhanger). */
export function trackPaywallHit(reason?: string): void {
  if (typeof window === "undefined") return;
  if (window.__karenPaywallHit) return;
  window.__karenPaywallHit = true;
  track("Paywall_Hit", reason ? { reason } : undefined);
}

/**
 * Unified track — Vercel Analytics + Meta custom + TikTok custom.
 * Safe no-op when pixels / analytics are not loaded yet.
 */
export function track(event: KarenTrackEvent, props?: TrackProps): void {
  if (typeof window === "undefined") return;

  try {
    vercelTrack(event, props as Record<string, string | number | boolean | null>);
  } catch (err) {
    console.warn("[karen/analytics] vercel track failed", err);
  }

  try {
    window.fbq?.("trackCustom", event, props || {});
  } catch (err) {
    console.warn("[karen/analytics] meta track failed", err);
  }

  try {
    window.ttq?.track?.(event, props || {});
  } catch (err) {
    console.warn("[karen/analytics] tiktok track failed", err);
  }
}
