/**
 * iOS / Apple WebView detection for Meta/TikTok ad traffic paywall routing.
 * Used to show the "Apple 30% tax" web-subscribe gate before Lemon Squeezy.
 */

export function isIOSDevice(ua?: string): boolean {
  if (typeof navigator === "undefined" && !ua) return false;
  const raw = (ua || navigator.userAgent || "").toLowerCase();
  // iPhone / iPad / iPod — plus iPadOS desktop UA ("Macintosh" + touch).
  if (/iphone|ipad|ipod/.test(raw)) return true;
  if (
    typeof navigator !== "undefined" &&
    /macintosh/.test(raw) &&
    Number(navigator.maxTouchPoints || 0) > 1
  ) {
    return true;
  }
  return false;
}

/** Copy for the iOS → web Lemon checkout gate. */
export const IOS_APPLE_TAX_HEADLINE = "Skip Apple's 30% tax";

export const IOS_APPLE_TAX_BODY =
  "Apple charges a 30% tax. Click here to subscribe securely on the web and save $5.";

export const IOS_APPLE_TAX_CTA = "Subscribe on the web — save $5";
