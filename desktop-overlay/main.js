const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
  shell,
  Notification,
  dialog,
} = require("electron");
const path = require("path");
const fs = require("fs");
const AutoLaunch = require("auto-launch");
const Store = require("electron-store");
const { createDataStore } = require("./src/data-store");
const { detectMoodFromText, detectMoodIdle, getSubjectivityResponse, getMorningGreeting, getMilestoneMessage } = require("./src/mood-engine");

const API_BASE = process.env.BUDDY_API_BASE || "https://www.buddieai.com";
const CHECKOUT_URLS = {
  buddie: "https://www.buddieai.com/pricing",
  sachapandit: "https://www.sachapandit.com/pricing",
};

const rawStore = new Store({ name: "buddy-offline-companion" });
const data = createDataStore(rawStore);

let activeWinModule = null;
try {
  activeWinModule = require("active-win");
} catch {
  activeWinModule = null;
}

let orbWindow = null;
let dashboardWindow = null;
let settingsWindow = null;
let tray = null;
let moodTimer = null;
let dailyTimer = null;
let absenceTimer = null;
let ipcRegistered = false;
let presenceCache = null;
let lastMood = "neutral";
let negativeStreak = 0;
let interactionCount = 0;
let lastAbsenceNotifiedAt = 0;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

const buddyAutoLaunch = new AutoLaunch({
  name: "Buddy Shadow Companion",
  path: process.execPath,
});

function shouldShowUpgradePrompt() {
  if (data.isPremium()) return false;
  const dismissed = data.getUpgradeDismissedAt();
  if (!dismissed) return true;
  const days = (Date.now() - new Date(dismissed).getTime()) / 86400000;
  return days >= 7;
}

function maybeShowUpgradeNotification() {
  if (!shouldShowUpgradePrompt()) return;
  const tenant = data.getSettings().tenant;
  const body =
    tenant === "sachapandit"
      ? "Unlock unlimited predictions, sacred geometry themes, and personalized daily blessings."
      : "Unlock advanced mood reports, hallucination alerts, and priority support.";
  showNotification(`${brandName()} Pro`, body);
}

function checkoutUrl() {
  const tenant = data.getSettings().tenant;
  return tenant === "sachapandit" ? CHECKOUT_URLS.sachapandit : CHECKOUT_URLS.buddie;
}

function brandName() {
  return data.getSettings().tenant === "sachapandit" ? "Sacha Pandit" : "Buddy AI";
}

async function getActiveWindowTitle() {
  if (!activeWinModule) return "";
  try {
    const info = await activeWinModule();
    return info?.title || "";
  } catch {
    return "";
  }
}

function showNotification(title, body) {
  if (!data.getSettings().notificationsEnabled) return;
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body });
  n.show();
}

function broadcastPresence() {
  presenceCache = data.getPresenceSnapshot();
  if (orbWindow && !orbWindow.isDestroyed()) {
    orbWindow.webContents.send("buddy:presence-updated", presenceCache);
  }
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send("buddy:data-updated", presenceCache);
  }
}

async function runMoodScan() {
  try {
    const settings = data.getSettings();
    const title = await getActiveWindowTitle();
    let mood;
    let source;
    let note = "";

    if (title && title.length > 2) {
      interactionCount += 1;
      mood = detectMoodFromText(title, lastMood, interactionCount);
      source = "window-title";
      note = title.slice(0, 120);
    } else {
      mood = detectMoodIdle(Date.now(), settings.tenant);
      source = "idle";
    }

    lastMood = mood;
    data.addMoodEvent({ mood, source, note });
    broadcastPresence();

    const negativeMoods = new Set(["concerned", "sleepy"]);
    if (negativeMoods.has(mood)) {
      negativeStreak += 1;
    } else {
      negativeStreak = 0;
    }

    if (negativeStreak >= 3) {
      const msg =
        settings.tenant === "sachapandit"
          ? "Your pandit notices you seem heavy. Would you like a moment of calm?"
          : "Your companion notices you seem heavy. Would you like a moment of calm?";
      showNotification(brandName(), msg);
      negativeStreak = 0;
    }
  } catch {
    /* keep overlay alive if mood scan fails */
  }
}

function checkAbsenceReminder() {
  const last = data.getLastInteractionAt();
  if (!last) return;
  const hours = (Date.now() - last) / 3600000;
  if (hours < 24) return;
  const now = Date.now();
  if (now - lastAbsenceNotifiedAt < 24 * 3600000) return;
  lastAbsenceNotifiedAt = now;
  showNotification(
    brandName(),
    "I have not felt your presence. Even the sun rests, but it always returns.",
  );
}

function scheduleDailyReminder() {
  if (dailyTimer) clearInterval(dailyTimer);
  dailyTimer = setInterval(() => {
    const first = new Date(data.raw.get("firstLaunchAt") || Date.now());
    const now = new Date();
    if (now.getHours() !== first.getHours() || now.getMinutes() !== first.getMinutes()) return;

    const history = data.getMoodHistory();
    const yesterdayConcerned = data.getYesterdayConcernedCount();
    const body = getMorningGreeting(history, yesterdayConcerned);
    showNotification(brandName(), body);
  }, 60_000);
}

function checkInstallMilestones() {
  const installDays = data.getInstallDayCount();
  const reached = data.getMilestonesReached();
  const milestone = getMilestoneMessage(installDays, reached);
  if (!milestone) return;
  data.markMilestone(milestone.day);
  showNotification(brandName(), milestone.message);
  if (orbWindow && !orbWindow.isDestroyed()) {
    orbWindow.webContents.send("buddy:milestone-celebration", { day: milestone.day, message: milestone.message });
  }
}

async function verifyLicenseOnline() {
  const profile = data.getUserProfile();
  const key = String(profile.licenseKey || "").trim();
  if (!key) {
    data.setPremiumUnlocked(false);
    data.setUserProfile({ tier: "free" });
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const domain =
      data.getSettings().tenant === "sachapandit" ? "www.sachapandit.com" : "www.buddieai.com";
    const res = await fetch(
      `${API_BASE}/api/licenses/verify?key=${encodeURIComponent(key)}&domain=${encodeURIComponent(domain)}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) throw new Error("verify failed");
    const body = await res.json();
    const valid = Boolean(body.valid);
    data.setPremiumUnlocked(valid);
    data.setUserProfile({ tier: valid ? "pro" : "free" });
    return valid;
  } catch {
    clearTimeout(timeout);
    return data.isPremium();
  }
}

function preloadPath(name) {
  return path.join(__dirname, name);
}

function loadLocalPage(win, fileName) {
  if (!win || win.isDestroyed()) return;
  win.loadFile(path.join(__dirname, fileName));
}

function createOrbWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const winW = 120;
  const winH = 120;

  orbWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: width - winW - 24,
    y: height - winH - 24,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: true,
    webPreferences: {
      preload: preloadPath("preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  orbWindow.setIgnoreMouseEvents(true, { forward: true });

  if (typeof orbWindow.setContentProtection === "function") {
    orbWindow.setContentProtection(true);
  }

  orbWindow.once("ready-to-show", () => {
    try {
      const { excludeFromCapture } = require("./win-capture-exclude");
      excludeFromCapture(orbWindow);
    } catch {
      /* optional */
    }
  });

  loadLocalPage(orbWindow, "orb.html");

  orbWindow.webContents.on("context-menu", (_e, params) => {
    showOrbContextMenu(params.x, params.y);
  });

  orbWindow.on("closed", () => {
    orbWindow = null;
  });
}

function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.focus();
    return;
  }
  dashboardWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 720,
    minHeight: 560,
    title: `${brandName()} — Offline Dashboard`,
    webPreferences: {
      preload: preloadPath("preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  loadLocalPage(dashboardWindow, "dashboard.html");
  dashboardWindow.on("closed", () => {
    dashboardWindow = null;
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 640,
    title: `${brandName()} — Settings`,
    webPreferences: {
      preload: preloadPath("preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  loadLocalPage(settingsWindow, "settings.html");
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function showOrbContextMenu(x, y) {
  const menu = Menu.buildFromTemplate([
    { label: "Open Dashboard", click: () => createDashboardWindow() },
    { label: "Settings", click: () => createSettingsWindow() },
    {
      label: "Upgrade to Pro",
      click: () => shell.openExternal(checkoutUrl()),
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
  if (orbWindow && !orbWindow.isDestroyed()) {
    menu.popup({ window: orbWindow, x, y });
  }
}

function createTrayIcon() {
  // 16×16 violet orb for system tray (Buddy default; tooltip updates with brand)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="#7c3aed"/><circle cx="6" cy="6" r="2" fill="#fff" opacity="0.45"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
}

function createTray() {
  if (tray) return;
  tray = new Tray(createTrayIcon());
  tray.setToolTip(brandName());
  const menu = Menu.buildFromTemplate([
    { label: "Show Orb", click: () => orbWindow?.show() },
    { label: "Open Dashboard", click: () => createDashboardWindow() },
    { label: "Settings", click: () => createSettingsWindow() },
    { type: "separator" },
    { label: "Upgrade to Pro", click: () => shell.openExternal(checkoutUrl()) },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => createDashboardWindow());
}

function registerIpc() {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle("buddy:get-presence", () => presenceCache || data.getPresenceSnapshot());

  ipcMain.handle("buddy:get-offline-data", () => ({
    ...data.exportAll(),
    ...data.getPresenceSnapshot(),
    premiumUnlocked: data.isPremium(),
  }));

  ipcMain.handle("buddy:save-settings", (_e, patch) => {
    const raw = patch && typeof patch === "object" ? patch : {};
    const { companionName, ...settingsPatch } = raw;
    const settings = data.setSettings(settingsPatch);
    if (companionName) data.setUserProfile({ companionName: String(companionName).trim() });
    broadcastPresence();
    return settings;
  });

  ipcMain.handle("buddy:save-profile", (_e, patch) => {
    const profile = data.setUserProfile(patch || {});
    broadcastPresence();
    return profile;
  });

  ipcMain.handle("buddy:record-interaction", () => {
    data.recordInteraction();
    interactionCount += 1;
    return true;
  });

  ipcMain.handle("buddy:open-dashboard", () => {
    createDashboardWindow();
    return true;
  });

  ipcMain.handle("buddy:open-settings", () => {
    createSettingsWindow();
    return true;
  });

  ipcMain.handle("buddy:open-external", (_e, url) => {
    const target = url ? String(url).trim() : checkoutUrl();
    try {
      const parsed = new URL(target);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        shell.openExternal(parsed.toString());
      }
    } catch {
      /* ignore invalid external URLs */
    }
    return true;
  });

  ipcMain.handle("buddy:dismiss-upgrade", () => {
    data.setUpgradeDismissedAt(new Date().toISOString());
    return true;
  });

  ipcMain.handle("buddy:verify-license", async (_e, key) => {
    if (key) data.setUserProfile({ licenseKey: String(key).trim() });
    const valid = await verifyLicenseOnline();
    broadcastPresence();
    return { valid, premium: data.isPremium(), tier: data.getUserProfile().tier };
  });

  ipcMain.handle("buddy:export-data", async () => {
    const payload = data.exportAll();
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Export mood data",
      defaultPath: path.join(app.getPath("desktop"), "companion-mood-export.json"),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePath) return { ok: false };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    return { ok: true, filePath };
  });

  ipcMain.handle("buddy:delete-data", async () => {
    const { response } = await dialog.showMessageBox({
      type: "warning",
      buttons: ["Cancel", "Delete"],
      defaultId: 0,
      message: "Delete all local companion data?",
      detail: "This cannot be undone.",
    });
    if (response !== 1) return { ok: false };
    data.clearAll();
    lastMood = "neutral";
    negativeStreak = 0;
    broadcastPresence();
    return { ok: true };
  });

  ipcMain.handle("buddy:manual-mood-note", (_e, payload) => {
    const text = String(payload?.text || "").trim();
    if (!text) return null;
    data.recordInteraction();
    interactionCount += 1;
    const mood = detectMoodFromText(text, lastMood, interactionCount);
    lastMood = mood;
    const entry = data.addMoodEvent({ mood, source: "user-input", note: text });
    broadcastPresence();
    const subjectivity = getSubjectivityResponse(text);
    if (subjectivity && orbWindow && !orbWindow.isDestroyed()) {
      orbWindow.webContents.send("buddy:guidance-message", subjectivity);
    }
    return { ...entry, guidance: subjectivity || null };
  });

  ipcMain.on("buddy:set-interactive", (_event, interactive) => {
    if (!orbWindow || orbWindow.isDestroyed()) return;
    if (interactive) {
      orbWindow.setIgnoreMouseEvents(false);
      orbWindow.setFocusable(true);
      data.recordInteraction();
    } else {
      orbWindow.setIgnoreMouseEvents(true, { forward: true });
      orbWindow.setFocusable(false);
    }
  });
}

function clearTimers() {
  if (moodTimer) clearInterval(moodTimer);
  if (dailyTimer) clearInterval(dailyTimer);
  if (absenceTimer) clearInterval(absenceTimer);
  moodTimer = null;
  dailyTimer = null;
  absenceTimer = null;
}

app.on("second-instance", () => {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.focus();
    return;
  }
  createDashboardWindow();
});

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;

  if (process.platform === "win32") {
    app.setAppUserModelId("com.buddieai.shadow-companion");
  }

  const envLicense = String(process.env.BUDDY_LICENSE_KEY || "").trim();
  if (envLicense) data.setUserProfile({ licenseKey: envLicense });

  registerIpc();
  createTray();
  createOrbWindow();
  broadcastPresence();

  void verifyLicenseOnline().then(() => broadcastPresence());

  await runMoodScan();
  moodTimer = setInterval(() => void runMoodScan(), 30_000);
  checkAbsenceReminder();
  absenceTimer = setInterval(checkAbsenceReminder, 60 * 60 * 1000);
  scheduleDailyReminder();
  setTimeout(() => checkInstallMilestones(), 8000);

  setTimeout(() => maybeShowUpgradeNotification(), 12_000);

  try {
    const enabled = rawStore.get("autoLaunch", true);
    if (enabled) {
      const isEnabled = await buddyAutoLaunch.isEnabled();
      if (!isEnabled) await buddyAutoLaunch.enable();
    }
  } catch {
    /* dev */
  }
});

app.on("before-quit", () => {
  clearTimers();
});

app.on("window-all-closed", () => {
  clearTimers();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!orbWindow) createOrbWindow();
});
