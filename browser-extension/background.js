const DEFAULTS = {
  buddyLicenseKey: "",
  buddyLicenseStatus: "inactive",
  buddyLastVerifiedAt: "",
  buddyMoodEventsToday: 0,
  buddyCompanionName: "Buddy",
};

const AI_CHAT_URL_PATTERNS = [
  "https://chat.openai.com/*",
  "https://chatgpt.com/*",
  "https://claude.ai/*",
  "https://gemini.google.com/*",
];

chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const updates = {};

  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (existing[key] === undefined) updates[key] = value;
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  if (details.reason === "install") {
    console.info("[Buddy AI] Extension installed — sign in at buddieai.com to auto-activate.");
  }
});

async function refreshAiChatTabs() {
  const tabs = await chrome.tabs.query({ url: AI_CHAT_URL_PATTERNS });
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "BUDDY_AI_REFRESH_WIDGET" });
    } catch {
      /* tab may not have content script yet */
    }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) return false;

  if (message.type === "BUDDY_AI_GET_STATUS") {
    chrome.storage.local
      .get(["buddyLicenseKey", "buddyLicenseStatus", "buddyMoodEventsToday", "buddyCompanionName"])
      .then((status) => sendResponse({ ok: true, status }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "BUDDY_APPLY_BOOTSTRAP") {
    const payload = message.payload || {};
    const licenseKey = String(payload.licenseKey || "").trim();
    if (!licenseKey) {
      sendResponse({ ok: false, error: "No license in bootstrap" });
      return true;
    }

    chrome.storage.local
      .set({
        buddyLicenseKey: licenseKey,
        buddyLicenseStatus: "active",
        buddyLastVerifiedAt: new Date().toISOString(),
        buddyCompanionName: String(payload.companionName || "Buddy"),
      })
      .then(() => refreshAiChatTabs())
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
