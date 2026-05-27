const BASE = "https://www.buddieai.com";

for (const path of ["/", "/login", "/pricing"]) {
  const r = await fetch(BASE + path);
  const t = await r.text();
  console.log("===", path, "status", r.status, "len", t.length);
  const title = t.match(/<title[^>]*>([^<]+)/i)?.[1];
  console.log("title:", title);
  const keys = [
    "Keep your orb alive",
    "ImmersiveHomepage",
    "Your AI Sidekick",
    "Buddy Free",
    "Buddy Pro",
    "Buddy Agency",
    "Continue with Google to keep",
    'name="email"',
    "cinematic-orb",
    "No credit card needed",
  ];
  for (const k of keys) console.log(" ", k, ":", t.includes(k));
  console.log("snippet:", t.replace(/\s+/g, " ").slice(0, 400));
  console.log();
}

const w = await fetch(`${BASE}/widget/livingface-widget.js`);
const wt = await w.text();
console.log("widget", w.status, wt.length);
console.log("  buddy-widget.css:", wt.includes("buddy-widget.css"));
console.log("  cdn.buddieai.com:", wt.includes("cdn.buddieai.com"));
console.log("  vapor:", /vapor/i.test(wt));
console.log("head:", wt.slice(0, 150));
