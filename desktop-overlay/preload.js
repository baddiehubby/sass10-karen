const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("buddyOverlay", {
  getPresence: () => ipcRenderer.invoke("buddy:get-presence"),
  getOfflineData: () => ipcRenderer.invoke("buddy:get-offline-data"),
  saveSettings: (patch) => ipcRenderer.invoke("buddy:save-settings", patch),
  saveProfile: (patch) => ipcRenderer.invoke("buddy:save-profile", patch),
  recordInteraction: () => ipcRenderer.invoke("buddy:record-interaction"),
  openDashboard: () => ipcRenderer.invoke("buddy:open-dashboard"),
  openSettings: () => ipcRenderer.invoke("buddy:open-settings"),
  openExternal: (url) => ipcRenderer.invoke("buddy:open-external", url),
  dismissUpgrade: () => ipcRenderer.invoke("buddy:dismiss-upgrade"),
  verifyLicense: (key) => ipcRenderer.invoke("buddy:verify-license", key),
  exportData: () => ipcRenderer.invoke("buddy:export-data"),
  deleteData: () => ipcRenderer.invoke("buddy:delete-data"),
  submitMoodNote: (payload) => ipcRenderer.invoke("buddy:manual-mood-note", payload),
  setInteractive: (interactive) => ipcRenderer.send("buddy:set-interactive", interactive),
  onPresenceUpdate: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("buddy:presence-updated", handler);
    return () => ipcRenderer.removeListener("buddy:presence-updated", handler);
  },
  onDataUpdated: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("buddy:data-updated", handler);
    return () => ipcRenderer.removeListener("buddy:data-updated", handler);
  },
  onGuidanceMessage: (callback) => {
    const handler = (_event, text) => callback(text);
    ipcRenderer.on("buddy:guidance-message", handler);
    return () => ipcRenderer.removeListener("buddy:guidance-message", handler);
  },
  onMilestoneCelebration: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("buddy:milestone-celebration", handler);
    return () => ipcRenderer.removeListener("buddy:milestone-celebration", handler);
  },
});
