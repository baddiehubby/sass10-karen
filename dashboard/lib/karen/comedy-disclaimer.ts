/**
 * Google Play / store policy gate — comedy disclaimer consent.
 * First visit must accept before any roast UI mounts.
 */

export const KAREN_COMEDY_DISCLAIMER_KEY = "karen.comedy.disclaimer.accepted";

export const KAREN_COMEDY_DISCLAIMER_TITLE =
  "⚠️ WARNING: COMEDIC ROASTING AHEAD.";

export const KAREN_COMEDY_DISCLAIMER_BODY =
  "SASS10 uses an AI character designed to be aggressively sarcastic and insulting for entertainment and motivation. Do not use this app if you are easily offended. By clicking 'I Accept', you agree to be roasted.";

export const KAREN_COMEDY_EXIT_URL = "https://www.google.com";

export function hasAcceptedComedyDisclaimer(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KAREN_COMEDY_DISCLAIMER_KEY) === "1";
  } catch {
    return false;
  }
}

export function acceptComedyDisclaimer(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KAREN_COMEDY_DISCLAIMER_KEY, "1");
  } catch {
    /* private mode — still allow session via in-memory accept in the gate */
  }
}

export function clearComedyDisclaimer(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KAREN_COMEDY_DISCLAIMER_KEY);
  } catch {
    /* ignore */
  }
}
