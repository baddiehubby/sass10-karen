/**
 * Direct extension download endpoint (no Chrome Web Store redirect).
 * Can be overridden with NEXT_PUBLIC_CHROME_EXTENSION_URL if you host the .crx elsewhere.
 */
export const CHROME_EXTENSION_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL?.trim() || "/api/download/buddy-extension";
