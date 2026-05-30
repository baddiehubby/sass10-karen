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
    if (!store.get("milestonesReached")) store.set("milestonesReached", []);
    if (!store.get("retention")) store.set("retention", { todayDate: "", todayConcernedCount: 0, yesterday: null });
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
    updateRetentionForMood(entry.mood);
    return entry;
  }

  function getRetention() {
    ensureDefaults();
    return store.get("retention") || { todayDate: "", todayConcernedCount: 0, yesterday: null };
  }

  function updateRetentionForMood(mood) {
    const today = new Date().toDateString();
    const retention = getRetention();
    if (retention.todayDate !== today) {
      store.set("retention", {
        todayDate: today,
        todayConcernedCount: mood === "concerned" ? 1 : 0,
        yesterday: retention.todayDate
          ? { date: retention.todayDate, concernedCount: retention.todayConcernedCount || 0 }
          : retention.yesterday || null,
      });
      return;
    }
    if (mood === "concerned") {
      store.set("retention", {
        ...retention,
        todayConcernedCount: (retention.todayConcernedCount || 0) + 1,
      });
    }
  }

  function getInstallDayCount() {
    const first = store.get("firstLaunchAt");
    if (!first) return 0;
    const ms = Date.now() - new Date(first).getTime();
    return Math.max(0, Math.floor(ms / 86400000));
  }

  function getMilestonesReached() {
    ensureDefaults();
    return store.get("milestonesReached") || [];
  }

  function markMilestone(day) {
    const reached = getMilestonesReached();
    if (reached.includes(day)) return reached;
    const next = [...reached, day].sort((a, b) => a - b);
    store.set("milestonesReached", next);
    return next;
  }

  function getYesterdayConcernedCount() {
    const retention = getRetention();
    const y = retention.yesterday;
    if (!y || !y.date) return 0;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (y.date === yesterday.toDateString()) return Number(y.concernedCount || 0);
    return 0;
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
      milestonesReached: getMilestonesReached(),
      installDayCount: getInstallDayCount(),
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
    getRetention,
    getInstallDayCount,
    getMilestonesReached,
    markMilestone,
    getYesterdayConcernedCount,
    raw: store,
  };
}

module.exports = { createDataStore, defaultUserProfile, defaultSettings };
