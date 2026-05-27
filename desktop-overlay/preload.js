const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("buddyOverlay", {
  getPresence: () => ipcRenderer.invoke("buddy:get-presence"),
  setInteractive: (interactive) => ipcRenderer.send("buddy:set-interactive", interactive),
  onPresenceUpdate: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("buddy:presence-updated", handler);
    return () => ipcRenderer.removeListener("buddy:presence-updated", handler);
  },
});
