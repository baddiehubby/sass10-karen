const fs = require("fs");

const files = [".next/server/chunks/7019.js", ".next/server/middleware.js"];
const pats = [
  [/NEXTAUTH_SECRET\s*=\s*[^\s"'`]+/g, "NEXTAUTH_SECRET="],
  [/GOOGLE_CLIENT_SECRET\s*=\s*[^\s"'`]+/g, "GOOGLE_CLIENT_SECRET="],
  [/LEMONSQUEEZY_API_KEY\s*=\s*[^\s"'`]+/g, "LEMONSQUEEZY_API_KEY="],
  [/LEMONSQUEEZY_WEBHOOK_SECRET\s*=\s*[^\s"'`]+/g, "LEMONSQUEEZY_WEBHOOK_SECRET="],
  [/DATABASE_URL\s*=\s*postgres[^"'`\s]*/g, "DATABASE_URL=postgres"],
  [/sk_live_[A-Za-z0-9]{10,}/g, "sk_live_"],
  [/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, "PRIVATE_KEY"],
];

let any = false;
for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  for (const [p, label] of pats) {
    const m = [...t.matchAll(p)].map((x) => x[0].slice(0, 80));
    if (m.length) {
      any = true;
      console.log(f, label, m.slice(0, 3));
    }
  }
}
if (!any) console.log("NO_LITERAL_SECRET_ASSIGNMENTS");
