/**
 * Prints redirect_uri sent to Google from the live sign-in flow.
 * Usage: node scripts/probe-google-oauth-uri.mjs [baseUrl]
 */
const base = (process.argv[2] || "https://www.buddieai.com").replace(/\/$/, "");

const signInUrl = `${base}/api/auth/signin/google`;
const res = await fetch(signInUrl, { redirect: "manual" });
const loc = res.headers.get("location") || "";

console.log("GET", signInUrl);
console.log("Status:", res.status);
console.log("Location:", loc.slice(0, 200) + (loc.length > 200 ? "..." : ""));

if (loc.includes("accounts.google.com")) {
  const u = new URL(loc);
  const redirectUri = u.searchParams.get("redirect_uri");
  console.log("\nredirect_uri sent to Google:");
  console.log(redirectUri || "(not found in URL)");
  const expected = `${base}/api/auth/callback/google`;
  console.log("\nExpected (if base is canonical):", expected);
  console.log(redirectUri === expected ? "MATCH" : "MISMATCH");
} else if (res.status >= 300 && res.status < 400) {
  console.log("\nIntermediate redirect — follow chain...");
  const r2 = await fetch(loc, { redirect: "manual" });
  const loc2 = r2.headers.get("location") || "";
  console.log("Next:", loc2.slice(0, 300));
  if (loc2.includes("accounts.google.com")) {
    const u = new URL(loc2);
    console.log("\nredirect_uri:", u.searchParams.get("redirect_uri"));
  }
}
