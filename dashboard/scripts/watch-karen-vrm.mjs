/**
 * Watches Downloads for karen.vrm / finished Chrome .crdownload and copies
 * into public/models/karen.vrm.
 *
 *   node scripts/watch-karen-vrm.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dest = path.resolve(__dirname, "../public/models/karen.vrm");
const downloads = path.join(os.homedir(), "Downloads");

const CANDIDATES = [
  "karen.vrm",
  "Karen.vrm",
  "KAREN.vrm",
];

function tryCopy(src) {
  if (!fs.existsSync(src)) return false;
  const st = fs.statSync(src);
  if (!st.isFile() || st.size < 10_000) return false;
  // Skip incomplete Chrome downloads
  if (src.toLowerCase().endsWith(".crdownload")) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[watch-karen-vrm] copied ${src} → ${dest} (${st.size} bytes)`);
  return true;
}

function scan() {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10_000) {
    console.log(`[watch-karen-vrm] already present: ${dest}`);
    return true;
  }
  for (const name of CANDIDATES) {
    if (tryCopy(path.join(downloads, name))) return true;
  }
  // Any .vrm in Downloads
  try {
    for (const name of fs.readdirSync(downloads)) {
      if (!name.toLowerCase().endsWith(".vrm")) continue;
      if (tryCopy(path.join(downloads, name))) return true;
    }
  } catch {
    /* ignore */
  }
  // Renamed finished Unconfirmed *.crdownload → if Chrome left a .vrm nearby
  try {
    for (const name of fs.readdirSync(downloads)) {
      if (!/unconfirmed/i.test(name)) continue;
      const full = path.join(downloads, name);
      // Still downloading
      if (name.toLowerCase().endsWith(".crdownload")) {
        const st = fs.statSync(full);
        console.log(
          `[watch-karen-vrm] download in progress: ${name} (${st.size} bytes)`,
        );
        continue;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

if (scan()) process.exit(0);

console.log(`[watch-karen-vrm] watching ${downloads} for *.vrm …`);
const timer = setInterval(() => {
  if (scan()) {
    clearInterval(timer);
    process.exit(0);
  }
}, 2000);
