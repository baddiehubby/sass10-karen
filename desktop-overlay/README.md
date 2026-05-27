# Buddy Shadow Companion (Desktop Overlay)

Always-on-top transparent orb for Windows and macOS. Syncs mood state from Buddie AI via `/api/presence/state`.

## Setup

1. Copy your license key from the Buddie AI dashboard.
2. Set config (first run creates `%APPDATA%/buddy-shadow-companion/config.json` on Windows):

```json
{
  "licenseKey": "your-license-key",
  "autoLaunch": true
}
```

Or set `BUDDY_LICENSE_KEY` before launch.

## Develop

```bash
cd desktop-overlay
npm install
npm start
```

## Package

```bash
npm run pack:win   # dist/BuddyShadowCompanion-*-win.exe
npm run pack:mac   # dist/BuddyShadowCompanion-*-mac.dmg
```

Place built installers in `desktop-overlay/dist/` for the dashboard download API.

## Privacy

Mood is synced using your license key only. Raw chat text never leaves your device from the browser extension or widget.
