/**
 * Copies the bundled widget into Next.js static files and the Chrome extension vendor folder:
 *   widget-lib/dist/livingface-widget.js → public/widget/livingface-widget.js
 *   widget-lib/dist/* → ../browser-extension/vendor/
 * (Run after `npm run build:widget`; `prebuild` does both.)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.join(__dirname, "..");
const repoRoot = path.join(dashboardRoot, "..");
const distDir = path.join(dashboardRoot, "widget-lib", "dist");
const src = path.join(distDir, "livingface-widget.js");
const destDir = path.join(dashboardRoot, "public", "widget");
const dest = path.join(destDir, "livingface-widget.js");
const extensionVendorDir = path.join(repoRoot, "browser-extension", "vendor");

function copyExtensionVendor() {
  fs.mkdirSync(extensionVendorDir, { recursive: true });
  for (const file of ["livingface-widget.js", "buddy-widget.css"]) {
    const from = path.join(distDir, file);
    if (!fs.existsSync(from)) {
      console.warn(`[copy-widget] Extension vendor skip — missing ${from}`);
      continue;
    }
    fs.copyFileSync(from, path.join(extensionVendorDir, file));
    console.log(`[copy-widget] Copied ${file} to browser-extension/vendor/`);
  }
}

if (fs.existsSync(src)) {
  fs.mkdirSync(destDir, { recursive: true });
  const cssSrc = path.join(dashboardRoot, "widget-lib", "src", "buddy-widget.css");
  const cssDist = path.join(distDir, "buddy-widget.css");
  const cssDest = path.join(destDir, "buddy-widget.css");
  if (fs.existsSync(cssDist)) {
    fs.copyFileSync(cssDist, cssDest);
  } else if (fs.existsSync(cssSrc)) {
    fs.copyFileSync(cssSrc, cssDest);
  }
  if (fs.existsSync(path.join(destDir, "buddy-widget.css"))) {
    console.log("[copy-widget] Copied buddy-widget.css to public/widget/");
  }
  fs.copyFileSync(src, dest);
  const kb = (fs.statSync(dest).size / 1024).toFixed(1);
  console.log(`[copy-widget] Copied to public/widget/livingface-widget.js (${kb} KB)`);
  copyExtensionVendor();
} else {
  console.warn("[copy-widget] Source not found:", src, "(skip — run npm run build:widget first)");
}
