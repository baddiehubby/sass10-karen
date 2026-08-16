const fs = require("fs");
const path = require("path");

const bad =
  /(NEXTAUTH_SECRET|GOOGLE_CLIENT_SECRET|LEMONSQUEEZY_API_KEY|LEMONSQUEEZY_WEBHOOK_SECRET)\s*=\s*[^\s"']+|DATABASE_URL\s*=\s*postgres|sk_live_[A-Za-z0-9]+|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/;

const hits = [];

function walk(d) {
  let ents;
  try {
    ents = fs.readdirSync(d, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === "cache") continue;
      walk(p);
    } else if (/\.(js|json|html|txt)$/.test(e.name)) {
      let t;
      try {
        t = fs.readFileSync(p, "utf8");
      } catch {
        continue;
      }
      if (bad.test(t)) hits.push(p);
    }
  }
}

walk(".next");
walk("public");
console.log(hits.length ? `LEAKS\n${hits.slice(0, 20).join("\n")}` : "SECRET_SCAN_PASS");
