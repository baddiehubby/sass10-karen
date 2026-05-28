/**
 * Local persistence layer for the offline desktop companion.
 */

const MAX_MOOD_EVENTS = 2000;

function defaultUserProfile() {
  return {
    companionName: "Buddy",
    personality: "friendly",
    licenseKey: "",
    tier: "free",
  };
}

function defaultSettings() {
  return {
    musicEnabled: false,
    theme: "buddy",
    notificationsEnabled: true,
    tenant: "buddie",
  };
}

function createDataStore(electronStore) {
  const store = electronStore;

  function ensureDefaults() {
    if (!store.get("userProfile")) store.set("userProfile", defaultUserProfile());
    if (!store.get("moodHistory")) store.set("moodHistory", []);
    if (!store.get("settings")) store.set("settings", defaultSettings());
    if (!store.get("firstLaunchAt")) store.set("firstLaunchAt", new Date().toISOString());
    if (store.get("premiumUnlocked") === undefined) store.set("premiumUnlocked", false);
    if (store.get("lastInteractionAt") === undefined) store.set("lastInteractionAt", Date.now());
  }

  function getUserProfile() {
    ensureDefaults();
    return { ...defaultUserProfile(), ...store.get("userProfile") };
  }

  function setUserProfile(patch) {
    const next = { ...getUserProfile(), ...patch };
    store.set("userProfile", next);
    return next;
  }

  function getSettings() {
    ensureDefaults();
    return { ...defaultSettings(), ...store.get("settings") };
  }

  function setSettings(patch) {
    const next = { ...getSettings(), ...patch };
    store.set("settings", next);
    return next;
  }

  function getMoodHistory() {
    ensureDefaults();
    return store.get("moodHistory") || [];
  }

  function addMoodEvent(event) {
    const history = getMoodHistory();
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      mood: event.mood || "neutral",
      timestamp: event.timestamp || new Date().toISOString(),
      source: event.source || "unknown",
      note: event.note || "",
    };
    history.push(entry);
    while (history.length > MAX_MOOD_EVENTS) history.shift();
    store.set("moodHistory", history);
    store.set("currentMood", entry.mood);
    store.set("lastMoodAt", entry.timestamp);
    return entry;
  }

  function getCurrentMood() {
    return store.get("currentMood") || "neutral";
  }

  function recordInteraction() {
    store.set("lastInteractionAt", Date.now());
  }

  function getLastInteractionAt() {
    return Number(store.get("lastInteractionAt") || 0);
  }

  function getUpgradeDismissedAt() {
    return store.get("upgradeDismissedAt") || null;
  }

  function setUpgradeDismissedAt(ts) {
    store.set("upgradeDismissedAt", ts || new Date().toISOString());
  }

  function isPremium() {
    return Boolean(store.get("premiumUnlocked"));
  }

  function setPremiumUnlocked(value) {
    store.set("premiumUnlocked", Boolean(value));
  }

  function exportAll() {
    ensureDefaults();
    return {
      userProfile: getUserProfile(),
      moodHistory: getMoodHistory(),
      settings: getSettings(),
      upgradeDismissedAt: getUpgradeDismissedAt(),
      firstLaunchAt: store.get("firstLaunchAt"),
      premiumUnlocked: isPremium(),
      exportedAt: new Date().toISOString(),
    };
  }

  function clearAll() {
    store.clear();
    ensureDefaults();
  }

  function getPresenceSnapshot() {
    const profile = getUserProfile();
    const history = getMoodHistory();
    return {
      currentMood: getCurrentMood(),
      moodHistory: history.slice(-20),
      lastCheckIn: store.get("lastMoodAt") || new Date().toISOString(),
      guidanceQueue: [],
      companionName: profile.companionName,
      licenseKey: profile.licenseKey,
      tier: profile.tier,
      premium: isPremium(),
      settings: getSettings(),
    };
  }

  ensureDefaults();
  return {
    ensureDefaults,
    getUserProfile,
    setUserProfile,
    getSettings,
    setSettings,
    getMoodHistory,
    addMoodEvent,
    getCurrentMood,
    recordInteraction,
    getLastInteractionAt,
    getUpgradeDismissedAt,
    setUpgradeDismissedAt,
    isPremium,
    setPremiumUnlocked,
    exportAll,
    clearAll,
    getPresenceSnapshot,
    raw: store,
  };
}

module.exports = { createDataStore, defaultUserProfile, defaultSettings };
