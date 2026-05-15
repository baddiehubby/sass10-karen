const API_BASE = "https://app.buddieai.com";

const els = {
  input: document.getElementById("licenseKey"),
  save: document.getElementById("saveButton"),
  badge: document.getElementById("statusBadge"),
  text: document.getElementById("statusText"),
  moods: document.getElementById("moodsToday"),
};

function setBadge(status, label) {
  els.badge.className = `badge badge-${status}`;
  els.badge.textContent = label;
}

function setBusy(isBusy) {
  els.save.disabled = isBusy;
  els.save.textContent = isBusy ? "Checking" : "Save";
}

function maskLicenseKey(key) {
  const trimmed = String(key || "").trim();
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

async function verifyLicense(licenseKey) {
  const params = new URLSearchParams({ key: licenseKey, domain: "extension" });
  const response = await fetch(`${API_BASE}/api/licenses/verify?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  return response.ok && data.valid ? data : null;
}

async function fetchMoodStats(licenseKey) {
  const params = new URLSearchParams({ licenseKey });
  const response = await fetch(`${API_BASE}/api/extensions/stats?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) return { totalMoodsToday: 0, activeLicense: false };
  return response.json();
}

async function refreshActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "BUDDY_AI_REFRESH_WIDGET" });
    }
  } catch {
    // The active tab may not be an AI chat page yet.
  }
}

async function paintStoredState() {
  const stored = await chrome.storage.local.get([
    "buddyLicenseKey",
    "buddyLicenseStatus",
    "buddyMoodEventsToday",
  ]);

  const licenseKey = String(stored.buddyLicenseKey || "").trim();
  els.input.value = licenseKey ? maskLicenseKey(licenseKey) : "";
  els.input.dataset.fullKey = licenseKey;
  els.moods.textContent = Number(stored.buddyMoodEventsToday || 0).toLocaleString();

  if (!licenseKey) {
    setBadge("idle", "Inactive");
    els.text.textContent = "Enter your Buddy AI license key to activate the orb.";
    els.moods.textContent = "-";
    return;
  }

  setBadge(stored.buddyLicenseStatus === "active" ? "active" : "idle", "Checking");
  els.text.textContent = "Verifying your Buddy AI license...";

  const verified = await verifyLicense(licenseKey);
  if (!verified) {
    setBadge("invalid", "Invalid key");
    els.text.textContent = "Invalid key. Get a trial at app.buddieai.com/dashboard.";
    await chrome.storage.local.set({ buddyLicenseStatus: "invalid", buddyMoodEventsToday: 0 });
    els.moods.textContent = "0";
    return;
  }

  const stats = await fetchMoodStats(licenseKey);
  await chrome.storage.local.set({
    buddyLicenseStatus: "active",
    buddyLastVerifiedAt: new Date().toISOString(),
    buddyMoodEventsToday: Number(stats.totalMoodsToday || 0),
  });

  setBadge("active", "Active");
  els.text.textContent = `Active ${verified.plan || "Buddy"} license. The orb is ready on AI chat pages.`;
  els.moods.textContent = Number(stats.totalMoodsToday || 0).toLocaleString();
}

function resolveLicenseKeyFromInput() {
  const raw = els.input.value.trim();
  const stored = String(els.input.dataset.fullKey || "").trim();
  if (!raw) return "";
  if (raw.includes("•") && stored) return stored;
  return raw;
}

async function saveLicense() {
  const licenseKey = resolveLicenseKeyFromInput();
  if (!licenseKey) {
    await chrome.storage.local.set({
      buddyLicenseKey: "",
      buddyLicenseStatus: "inactive",
      buddyMoodEventsToday: 0,
    });
    setBadge("idle", "Inactive");
    els.text.textContent = "Enter your Buddy AI license key to activate the orb.";
    els.moods.textContent = "-";
    await refreshActiveTab();
    return;
  }

  setBusy(true);
  setBadge("idle", "Checking");
  els.text.textContent = "Validating your license with Buddy AI...";

  try {
    const verified = await verifyLicense(licenseKey);
    const nextStatus = verified ? "active" : "invalid";
    const stats = verified ? await fetchMoodStats(licenseKey) : { totalMoodsToday: 0 };

    await chrome.storage.local.set({
      buddyLicenseKey: licenseKey,
      buddyLicenseStatus: nextStatus,
      buddyLastVerifiedAt: new Date().toISOString(),
      buddyMoodEventsToday: Number(stats.totalMoodsToday || 0),
    });

    if (verified) {
      setBadge("active", "Active");
      els.text.textContent = "Active. Buddy AI will appear in ChatGPT, Claude, and Gemini.";
      els.moods.textContent = Number(stats.totalMoodsToday || 0).toLocaleString();
    } else {
      setBadge("invalid", "Invalid key");
      els.text.textContent = "Invalid key. Get a trial at app.buddieai.com/dashboard.";
      els.moods.textContent = "0";
    }

    await refreshActiveTab();
  } catch {
    setBadge("invalid", "Offline");
    els.text.textContent = "Could not reach Buddy AI. Please try again in a moment.";
  } finally {
    setBusy(false);
  }
}

document.addEventListener("DOMContentLoaded", paintStoredState);
els.save.addEventListener("click", saveLicense);
els.input.addEventListener("focus", () => {
  if (els.input.dataset.fullKey) {
    els.input.value = "";
    delete els.input.dataset.fullKey;
  }
});
els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveLicense();
});
