#!/usr/bin/env node
/**
 * Production health-check for https://www.buddieai.com
 * Usage: node scripts/health-check.mjs
 */

const BASE = process.env.HEALTH_CHECK_BASE_URL || "https://www.buddieai.com";
const LICENSE_KEY = "HQ-C7FBD6ABA5114A278AED629B";
const MIN_WIDGET_BYTES = 50 * 1024;

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchText(path) {
  const url = path.startsWith("http") ? path : `${BASE.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "BuddieAI-HealthCheck/1.0" },
    redirect: "follow",
  });
  const text = await res.text();
  return { res, text, url };
}

async function checkHomepage() {
  const name = "GET / (homepage)";
  try {
    const { res, text } = await fetchText("/");
    if (res.status !== 200) {
      fail(name, `HTTP ${res.status}`);
      return;
    }
    const markers = [
      "Your AI companion",
      "always listening",
      "ImmersiveHomepage",
      "CinematicOrb",
      "Keep your orb alive",
    ];
    const hit = markers.filter((m) => text.includes(m));
    if (hit.length >= 1) {
      pass(name, `HTTP 200, immersive markers: ${hit.join(", ")}`);
    } else {
      fail(name, "HTTP 200 but missing immersive homepage content");
    }
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
  }
}

async function checkLogin() {
  const name = "GET /login";
  try {
    const { res, text } = await fetchText("/login");
    if (res.status !== 200) {
      fail(name, `HTTP ${res.status}`);
      return;
    }
    if (text.includes("Continue with Google")) {
      pass(name, "contains Continue with Google");
    } else {
      fail(name, "missing Continue with Google");
    }
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
  }
}

async function checkWidget() {
  const name = "GET /widget/livingface-widget.js";
  try {
    const url = `${BASE.replace(/\/$/, "")}/widget/livingface-widget.js`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BuddieAI-HealthCheck/1.0" },
      redirect: "follow",
    });
    const buf = await res.arrayBuffer();
    const size = buf.byteLength;
    if (res.status !== 200) {
      fail(name, `HTTP ${res.status}`);
      return;
    }
    if (size > MIN_WIDGET_BYTES) {
      pass(name, `${(size / 1024).toFixed(1)} KB`);
    } else {
      fail(name, `only ${size} bytes (need > ${MIN_WIDGET_BYTES})`);
    }
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
  }
}

async function checkLicenseVerify() {
  const name = "GET /api/licenses/verify";
  const path = `/api/licenses/verify?key=${encodeURIComponent(LICENSE_KEY)}&domain=test.com`;
  try {
    const { res, text } = await fetchText(path);
    console.log(`INFO  ${name} — HTTP ${res.status}`);
    console.log(`INFO  response: ${text.slice(0, 500)}`);
    if (res.status >= 200 && res.status < 500) {
      pass(name, `HTTP ${res.status}`);
    } else {
      fail(name, `HTTP ${res.status}`);
    }
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  console.log(`Health check: ${BASE}\n`);
  await checkHomepage();
  await checkLogin();
  await checkWidget();
  await checkLicenseVerify();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- Summary: ${results.length - failed.length}/${results.length} passed ---`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main();
