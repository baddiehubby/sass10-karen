/**
 * One-off QA health check — not part of app runtime.
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function fetchStatus(url, opts = {}) {
  const res = await fetch(url, { redirect: "manual", ...opts });
  const loc = res.headers.get("location");
  return {
    url,
    status: res.status,
    location: loc || null,
    contentType: res.headers.get("content-type") || "",
  };
}

async function fetchWithBody(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, text: text.slice(0, 500), json };
}

console.log("=== HTTP ROUTE CHECKS ===\n");
const routes = [
  "https://www.buddieai.com",
  "https://www.buddieai.com/login",
  "https://www.buddieai.com/register",
  "https://www.buddieai.com/pricing",
  "https://www.buddieai.com/demo",
  "https://www.buddieai.com/dashboard",
];
for (const url of routes) {
  const r = await fetchStatus(url);
  console.log(`${url} → ${r.status}${r.location ? ` → ${r.location}` : ""}`);
}

console.log("\n=== WIDGET FILE ===\n");
const widgetRes = await fetch("https://www.buddieai.com/widget/livingface-widget.js");
const widgetBuf = await widgetRes.arrayBuffer();
const widgetCt = widgetRes.headers.get("content-type") || "";
console.log(`Status: ${widgetRes.status}`);
console.log(`Content-Type: ${widgetCt}`);
console.log(`Size: ${widgetBuf.byteLength} bytes`);

console.log("\n=== API /api/chat POST ===\n");
const chat = await fetchWithBody("https://www.buddieai.com/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "Hello" }),
});
console.log(`Status: ${chat.status}`);
console.log(`Body: ${chat.text}`);

console.log("\n=== LICENSE VERIFY GET ===\n");
const lic = await fetchWithBody(
  "https://www.buddieai.com/api/licenses/verify?key=HQ-C7FBD6ABA5114A278AED629B&domain=test.com",
  { method: "GET" },
);
console.log(`Status: ${lic.status}`);
console.log(`Body: ${JSON.stringify(lic.json ?? lic.text, null, 2)}`);
