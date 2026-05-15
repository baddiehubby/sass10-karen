const DEFAULTS = {
  buddyLicenseKey: "",
  buddyLicenseStatus: "inactive",
  buddyLastVerifiedAt: "",
  buddyMoodEventsToday: 0,
};

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const updates = {};

  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (existing[key] === undefined) updates[key] = value;
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "BUDDY_AI_GET_STATUS") return false;

  chrome.storage.local
    .get(["buddyLicenseKey", "buddyLicenseStatus", "buddyMoodEventsToday"])
    .then((status) => sendResponse({ ok: true, status }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
