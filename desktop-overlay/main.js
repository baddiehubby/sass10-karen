const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const AutoLaunch = require("auto-launch");
const Store = require("electron-store");

const API_BASE = process.env.BUDDY_API_BASE || "https://www.buddieai.com";
const store = new Store({ name: "buddy-shadow-config" });
const presencePath = () => path.join(app.getPath("userData"), "buddy-presence.json");

let mainWindow = null;
let presenceCache = null;
let pollTimer = null;

const buddyAutoLaunch = new AutoLaunch({
  name: "Buddy Shadow Companion",
  path: process.execPath,
});

function defaultPresence() {
  return {
    currentMood: "neutral",
    moodHistory: [],
    lastCheckIn: new Date().toISOString(),
    guidanceQueue: [],
    companionName: store.get("companionName", "Buddy"),
    licenseKey: store.get("licenseKey", ""),
  };
}

function writePresenceFile(state) {
  try {
    fs.writeFileSync(presencePath(), JSON.stringify(state, null, 2), "utf8");
  } catch {
    /* ignore disk errors */
  }
}

function readPresenceFile() {
  try {
    const raw = fs.readFileSync(presencePath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchPresenceFromApi() {
  const licenseKey = String(store.get("licenseKey", "")).trim();
  if (!licenseKey) return readPresenceFile() || defaultPresence();

  const response = await fetch(
    `${API_BASE}/api/presence/state?licenseKey=${encodeURIComponent(licenseKey)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) return readPresenceFile() || defaultPresence();
  const data = await response.json();
  const state = {
    currentMood: data.currentMood || "neutral",
    moodHistory: data.moodHistory || [],
    lastCheckIn: data.lastCheckIn || new Date().toISOString(),
    guidanceQueue: data.guidanceQueue || [],
    companionName: data.companionName || "Buddy",
    licenseKey,
  };
  writePresenceFile(state);
  store.set("companionName", state.companionName);
  return state;
}

function broadcastPresence(state) {
  presenceCache = state;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("buddy:presence-updated", state);
  }
}

async function refreshPresence() {
  try {
    const state = await fetchPresenceFromApi();
    broadcastPresence(state);
  } catch {
    const fallback = readPresenceFile() || defaultPresence();
    broadcastPresence(fallback);
  }
}

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const winW = 120;
  const winH = 120;
  const x = width - winW - 24;
  const y = height - winH - 24;

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  if (typeof mainWindow.setContentProtection === "function") {
    mainWindow.setContentProtection(true);
  }

  mainWindow.once("ready-to-show", () => {
    try {
      const { excludeFromCapture } = require("./win-capture-exclude");
      excludeFromCapture(mainWindow);
    } catch {
      /* optional Windows module */
    }
  });

  mainWindow.loadFile(path.join(__dirname, "orb.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("buddy:get-presence", () => presenceCache || readPresenceFile() || defaultPresence());

ipcMain.on("buddy:set-interactive", (_event, interactive) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (interactive) {
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setFocusable(true);
  } else {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    mainWindow.setFocusable(false);
  }
});

app.whenReady().then(async () => {
  const envLicense = String(process.env.BUDDY_LICENSE_KEY || "").trim();
  if (envLicense) store.set("licenseKey", envLicense);

  try {
    const enabled = store.get("autoLaunch", true);
    if (enabled) {
      const isEnabled = await buddyAutoLaunch.isEnabled();
      if (!isEnabled) await buddyAutoLaunch.enable();
    }
  } catch {
    /* auto-launch may fail in dev */
  }

  createOverlayWindow();
  await refreshPresence();

  pollTimer = setInterval(refreshPresence, 60_000);
});

app.on("window-all-closed", () => {
  if (pollTimer) clearInterval(pollTimer);
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createOverlayWindow();
});
