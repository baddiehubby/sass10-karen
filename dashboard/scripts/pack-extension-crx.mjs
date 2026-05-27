import { existsSync, mkdirSync, renameSync } from "fs";
import path from "path";
import { spawnSync } from "child_process";

const repoRoot = path.resolve(process.cwd(), "..");
const extensionDir = path.join(repoRoot, "browser-extension");
const distDir = path.join(extensionDir, "dist");
const keyPath = path.join(extensionDir, "key.pem");
const outCrx = path.join(distDir, "buddy-ai.crx");

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const chromeBin = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chromeBin) {
  console.error("[pack-extension] Chrome executable not found.");
  console.error("Set CHROME_PATH, e.g. CHROME_PATH=\"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\"");
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });

const args = [`--pack-extension=${extensionDir}`];
if (existsSync(keyPath)) {
  args.push(`--pack-extension-key=${keyPath}`);
}

console.log(`[pack-extension] Using Chrome: ${chromeBin}`);
const packed = spawnSync(chromeBin, args, { stdio: "inherit" });
if (packed.status !== 0) {
  process.exit(packed.status ?? 1);
}

const generatedCrx = `${extensionDir}.crx`;
const generatedKey = `${extensionDir}.pem`;

if (existsSync(generatedCrx)) {
  renameSync(generatedCrx, outCrx);
  console.log(`[pack-extension] Wrote: ${outCrx}`);
}
if (!existsSync(keyPath) && existsSync(generatedKey)) {
  renameSync(generatedKey, keyPath);
  console.log(`[pack-extension] Saved key: ${keyPath}`);
}
