/**
 * Headless console error scan for buddieai.com homepage.
 */
import puppeteer from "puppeteer";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const screenshotPath = join(root, "homepage-test.png");

const errors = [];
const warnings = [];

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();

page.on("console", (msg) => {
  const type = msg.type();
  const text = msg.text();
  if (type === "error") errors.push(text);
  else if (type === "warning") warnings.push(text);
});

page.on("pageerror", (err) => {
  errors.push(`[pageerror] ${err.message}`);
});

try {
  await page.goto("https://www.buddieai.com", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 5000));
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Screenshot saved: ${screenshotPath}`);
} catch (err) {
  errors.push(`[navigation] ${err.message}`);
}

await browser.close();

console.log("\n=== console.error ===");
if (errors.length === 0) console.log("(none)");
else errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));

console.log("\n=== console.warn ===");
if (warnings.length === 0) console.log("(none)");
else warnings.forEach((w, i) => console.log(`${i + 1}. ${w}`));
