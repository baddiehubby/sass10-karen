/**
 * Direct extension download endpoint (no Chrome Web Store redirect).
 * Can be overridden with NEXT_PUBLIC_CHROME_EXTENSION_URL if you host the .crx elsewhere.
 */
export const CHROME_EXTENSION_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL?.trim() || "/api/download/buddy-extension";

export const DESKTOP_COMPANION_WIN_URL = "/api/download/desktop-companion?platform=win";
export const DESKTOP_COMPANION_MAC_URL = "/api/download/desktop-companion?platform=mac";
