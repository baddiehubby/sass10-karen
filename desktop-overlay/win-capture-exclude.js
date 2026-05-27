/** Windows: exclude overlay from screen capture (SetWindowDisplayAffinity). */
const WDA_EXCLUDEFROMCAPTURE = 0x00000011;

function excludeFromCapture(browserWindow) {
  if (process.platform !== "win32" || !browserWindow) return false;
  try {
    const koffi = require("koffi");
    const user32 = koffi.load("user32.dll");
    const SetWindowDisplayAffinity = user32.func(
      "bool __stdcall SetWindowDisplayAffinity(void * hWnd, uint32 dwAffinity)",
    );
    const hwndBuf = browserWindow.getNativeWindowHandle();
    const hwnd = hwndBuf.readBigUInt64LE(0);
    return Boolean(SetWindowDisplayAffinity(koffi.decode(hwnd, "void *"), WDA_EXCLUDEFROMCAPTURE));
  } catch (err) {
    console.warn("[Buddy overlay] Windows capture exclusion unavailable:", err?.message || err);
    return false;
  }
}

module.exports = { excludeFromCapture };
