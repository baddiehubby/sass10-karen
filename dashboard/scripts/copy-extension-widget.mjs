import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardRoot = join(__dirname, "..");
const repoRoot = join(dashboardRoot, "..");
const distDir = join(dashboardRoot, "widget-lib", "dist");
const vendorDir = join(repoRoot, "browser-extension", "vendor");
const files = ["livingface-widget.js", "buddy-widget.css"];

mkdirSync(vendorDir, { recursive: true });

for (const file of files) {
  const source = join(distDir, file);
  if (!existsSync(source)) {
    throw new Error(`Missing ${source}. Run npm run build:widget first.`);
  }
  copyFileSync(source, join(vendorDir, file));
  console.log(`[extension] copied ${file}`);
}
