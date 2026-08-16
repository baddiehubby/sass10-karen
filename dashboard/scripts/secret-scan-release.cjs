/**
 * Pre-release secret scan — working tree + tracked files.
 * Exit 1 on real credential patterns (not placeholders).
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
process.chdir(root);

const PLACEHOLDER = /YOUR_VALUE_HERE|PLACEHOLDER|changeme|example\.com|localhost|http:\/\/localhost/i;

const PATTERNS = [
  { name: "private_key_block", re: /-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/ },
  { name: "stripe_live", re: /sk_live_[A-Za-z0-9]{16,}/ },
  { name: "stripe_test", re: /sk_test_[A-Za-z0-9]{16,}/ },
  { name: "google_oauth_secret", re: /GOCSPX-[A-Za-z0-9_-]{20,}/ },
  { name: "github_pat", re: /ghp_[A-Za-z0-9]{20,}/ },
  { name: "postgres_creds", re: /postgres(?:ql)?:\/\/[^:\s\/"']+:[^@\s\/"']+@/ },
  { name: "aws_access_key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "jwt_hardcoded", re: /eyJhbGciOiJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
];

const ASSIGN = [
  /(?:LEMONSQUEEZY_API_KEY|LEMONSQUEEZY_WEBHOOK_SECRET|NEXTAUTH_SECRET|GOOGLE_CLIENT_SECRET|EIDATA_HASH_SALT|VAPID_PRIVATE_KEY|CRON_SECRET|DATABASE_URL|POSTGRES_URL)\s*=\s*["'](?!YOUR_VALUE_HERE)(?!PLACEHOLDER)(?!test_)(?!http:\/\/localhost)([A-Za-z0-9\/+=._\-]{12,})["']/,
];

const SKIP_DIR = /(^|[\\/])(node_modules|\.next|\.git|dist|coverage|\.turbo|browser-extension[\\/]vendor)([\\/]|$)/;
const SKIP_FILE = /\.(png|jpg|jpeg|gif|webp|woff2?|ico|map|pack|db|sqlite3?)$/i;

function listTracked() {
  return execSync("git ls-files -z", { encoding: "buffer" })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

function walkUntrackedHints() {
  const out = [];
  for (const name of [".env", ".env.local", ".env.production", ".env.local.bak"]) {
    const p = path.join("dashboard", name);
    if (fs.existsSync(p)) out.push({ path: p, ignored: true });
  }
  return out;
}

const findings = [];
const tracked = listTracked();

for (const rel of tracked) {
  if (SKIP_DIR.test(rel) || SKIP_FILE.test(rel)) continue;
  if (rel.endsWith(".db") || rel.endsWith(".sqlite")) {
    findings.push({ path: rel, name: "tracked_database", detail: "local DB must not be tracked" });
    continue;
  }
  let text;
  try {
    text = fs.readFileSync(rel, "utf8");
  } catch {
    continue;
  }
  if (PLACEHOLDER.test(path.basename(rel)) && rel.endsWith(".example")) {
    // still scan example for accidental real values
  }
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) {
      // jose / docs may mention BEGIN PRIVATE KEY as format string
      if (name === "private_key_block" && /BEGIN PRIVATE KEY/.test(text) && !/-----BEGIN[\s\S]{20,}PRIVATE KEY-----[\s\S]{40,}/.test(text)) {
        continue;
      }
      if (name === "private_key_block" && /jose|PEM|format|template|example/i.test(text) && !/MII[A-Za-z0-9+/=]{40,}/.test(text)) {
        continue;
      }
      // Test fixtures may mention credential-shaped URLs without being live secrets.
      if (name === "postgres_creds" && /\.test\.(ts|tsx|js|mjs|cjs)$/.test(rel)) {
        continue;
      }
      findings.push({ path: rel, name, detail: "pattern match" });
    }
  }
  if (!rel.endsWith(".env.example")) {
    for (const re of ASSIGN) {
      const m = text.match(re);
      if (m && m[1] && !PLACEHOLDER.test(m[1]) && m[1] !== '""' && m[1] !== "''") {
        findings.push({ path: rel, name: "secret_assignment", detail: m[0].slice(0, 48) });
      }
    }
  } else {
    // .env.example must only use placeholders or empty/public localhost
    for (const line of text.split(/\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const val = m[2].trim();
      if (!val) continue;
      if (PLACEHOLDER.test(val)) continue;
      if (/^(true|false|0|1)$/i.test(val)) continue;
      if (/^mailto:/i.test(val)) continue;
      if (/^https?:\/\/(localhost|www\.buddieai\.com|chrome\.webstore)/i.test(val)) continue;
      findings.push({ path: rel, name: "env_example_non_placeholder", detail: m[1] });
    }
  }
}

const localEnv = walkUntrackedHints();
for (const e of localEnv) {
  const trackedHit = tracked.includes(e.path.replace(/\\/g, "/"));
  if (trackedHit) findings.push({ path: e.path, name: "env_file_tracked", detail: "must not be tracked" });
}

// Forbid staging of secret filenames
const staged = execSync("git diff --cached --name-only", { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
for (const s of staged) {
  if (/(^|\/)\.env(?!\.example$)/.test(s) || /\.(pem|p12|pfx)$/.test(s) || /credentials/i.test(s)) {
    findings.push({ path: s, name: "staged_secret_file", detail: "refusing" });
  }
}

if (findings.length) {
  console.error("SECRET SCAN FAILED");
  for (const f of findings) console.error(`- [${f.name}] ${f.path}: ${f.detail}`);
  process.exit(1);
}

console.log("SECRET SCAN PASS");
console.log(`tracked_files_scanned=${tracked.length}`);
console.log(`local_env_present_but_ignored=${localEnv.map((e) => e.path).join(",") || "none"}`);
process.exit(0);
