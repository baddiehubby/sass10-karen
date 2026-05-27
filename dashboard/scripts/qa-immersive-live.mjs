/**
 * Live post-deploy health check for immersive redesign.
 * Usage: node scripts/qa-immersive-live.mjs
 */
import puppeteer from "puppeteer";

const BASE = "https://www.buddieai.com";
const WHISPERS = [
  "You seem far away tonight.",
  "I feel quiet energy from you.",
  "Something's on your mind.",
  "You're moving fast today.",
  "I'm listening.",
  "Breathe. I'm here.",
];

const results = [];

function pass(name, detail = "") {
  results.push({ name, status: "PASS", detail });
}
function fail(name, detail = "") {
  results.push({ name, status: "FAIL", detail });
}

async function fetchText(url, redirect = "follow") {
  const res = await fetch(url, { redirect });
  const text = await res.text();
  return { status: res.status, url: res.url, text };
}

async function checkHomepageHtml() {
  const { status, text } = await fetchText(`${BASE}/`);
  const hasCta = text.includes("Keep your orb alive");
  const hasFreeLine =
    text.includes("No credit card needed") && text.includes("free forever");
  const oldMarketing =
    text.includes("Your AI Sidekick That Keeps You Sane") ||
    text.includes("Choose Your Buddy") ||
    text.includes("Start 14");

  if (status !== 200) {
    fail("1a Homepage HTML fetch", `HTTP ${status}`);
    return;
  }
  if (!hasCta) {
    fail("1a Homepage contains CTA text", "Missing 'Keep your orb alive' in HTML/RSC payload");
  } else {
    pass("1a Homepage contains CTA text", "Found 'Keep your orb alive'");
  }
  if (!hasFreeLine) {
    fail("1c Free-forever line in HTML", "Missing no-credit-card / free forever text in initial HTML");
  } else {
    pass("1c Free-forever line in HTML", "Found in initial payload");
  }
  if (oldMarketing) {
    fail("1d No old marketing sections", "Still contains legacy marketing copy in HTML");
  } else {
    pass("1d No old marketing sections", "Legacy hero/pricing blocks not in HTML");
  }
}

async function checkHomepageBrowser() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });

    const bodyAfterLoad = await page.evaluate(() => document.body.innerText);
    const hasCanvas = (await page.$("canvas")) !== null;

    if (!hasCanvas) {
      fail("1b Orb canvas present", "No <canvas> (Three.js orb) found on homepage");
    } else {
      pass("1b Orb canvas present", "WebGL canvas detected");
    }

    await new Promise((r) => setTimeout(r, 13000));

    const bodyAfterWait = await page.evaluate(() => document.body.innerText);
    const foundWhisper = WHISPERS.find((w) => bodyAfterWait.includes(w));
    const hasCtaVisible = bodyAfterWait.includes("Keep your orb alive");
    const hasFreeVisible =
      bodyAfterWait.includes("No credit card needed") &&
      bodyAfterWait.includes("free forever");

    if (foundWhisper) {
      pass("1b Ambient observation after 12s", `Saw: "${foundWhisper}"`);
    } else {
      fail(
        "1b Ambient observation after 12s",
        `No whisper found after 13s wait. Body snippet: ${bodyAfterWait.slice(0, 400).replace(/\s+/g, " ")}`,
      );
    }
    if (hasCtaVisible) {
      pass("1b CTA visible after wait", "Keep your orb alive visible");
    } else {
      fail("1b CTA visible after wait", "CTA not in visible text after 13s");
    }
    if (hasFreeVisible) {
      pass("1b Free-forever line visible", "Visible after CTA delay");
    } else {
      fail(
        "1b Free-forever line visible",
        `Not in body text. Initial load had: ${bodyAfterLoad.includes("No credit card")}`,
      );
    }

    const hasSiteHeader = await page.evaluate(() => {
      const nav = document.querySelector("header");
      if (!nav) return false;
      const t = nav.innerText || "";
      return t.includes("Integrations") || t.includes("Pricing") && t.includes("Blog");
    });
    if (hasSiteHeader) {
      fail("1 Homepage no global header", "Site header nav still visible on /");
    } else {
      pass("1 Homepage no global header", "No marketing site header on /");
    }
  } finally {
    await browser.close();
  }
}

async function checkLogin() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 60000 });
    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);

    const hasGoogle =
      text.includes("Continue with Google") &&
      (html.includes('signIn("google"') || html.includes("Continue with Google"));
    const hasEmail = await page.$('input[name="email"]');
    const hasPassword = await page.$('input[name="password"]');
    const hasTagline = text.includes("Continue with Google to keep your orb alive");

    if (hasGoogle && !hasEmail && !hasPassword) {
      pass("2 Minimal login", "Google button only, no email/password fields");
    } else {
      fail(
        "2 Minimal login",
        `Google=${hasGoogle} emailField=${Boolean(hasEmail)} passwordField=${Boolean(hasPassword)} tagline=${hasTagline}`,
      );
    }
  } finally {
    await browser.close();
  }
}

async function checkDashboardRedirect() {
  const res = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  const loc = res.headers.get("location") || "";
  if (res.status >= 300 && res.status < 400 && loc.includes("/login")) {
    pass("3 Dashboard protected", `${res.status} → ${loc}`);
  } else if (res.status === 200) {
    fail("3 Dashboard protected", `Got 200 without redirect (may be cached session at edge)`);
  } else {
    fail("3 Dashboard protected", `Status ${res.status}, location: ${loc || "(none)"}`);
  }
}

async function checkPricing() {
  const { status, text } = await fetchText(`${BASE}/pricing`);
  if (status !== 200) {
    fail("4 Pricing page", `HTTP ${status}`);
    return;
  }
  const checks = {
    free: text.includes("Buddy Free") && (text.includes("$0") || text.includes("$0/month")),
    pro: text.includes("Buddy Pro") && text.includes("$19"),
    agency: text.includes("Buddy Agency") && text.includes("$99"),
    perpetual:
      /forever|perpetual|not a trial/i.test(text) ||
      text.includes("free forever") ||
      text.includes("Free forever"),
  };
  const allOk = Object.values(checks).every(Boolean);
  if (allOk) {
    pass("4 Pricing three tiers + perpetual", JSON.stringify(checks));
  } else {
    fail("4 Pricing three tiers + perpetual", JSON.stringify(checks));
  }
}

async function checkWidget() {
  const res = await fetch(`${BASE}/widget/livingface-widget.js`);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder().decode(buf);
  const size = buf.byteLength;
  const markers = [
    "resolveWidgetCssHref",
    "buddy-widget.css",
    "vapor",
    "particle",
    "cdn.buddieai.com",
  ];
  const found = markers.filter((m) => text.includes(m));
  if (res.status === 200 && size > 20000) {
    if (text.includes("cdn.buddieai.com") && !text.includes("/widget/buddy-widget.css")) {
      fail(
        "5 Widget served",
        `200 OK (${size} bytes) but still references cdn.buddieai.com — may be old bundle`,
      );
    } else {
      pass("5 Widget served", `200 OK, ${size} bytes, markers: ${found.join(", ") || "minified"}`);
    }
  } else {
    fail("5 Widget served", `Status ${res.status}, size ${size} bytes`);
  }
}

console.log("Running live QA against", BASE, "\n");
await checkHomepageHtml();
await checkHomepageBrowser();
await checkLogin();
await checkDashboardRedirect();
await checkPricing();
await checkWidget();

console.log("\n=== HEALTH CHECK REPORT ===\n");
for (const r of results) {
  console.log(`${r.status.padEnd(5)} ${r.name}`);
  if (r.detail) console.log(`       ${r.detail}`);
}
const failed = results.filter((r) => r.status === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
