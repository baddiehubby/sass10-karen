# Buddy AI — Chrome Extension

Official-style emotional safety layer for **ChatGPT**, **Claude**, and **Gemini**. Uses the same widget bundle, license verification, mood detection, and analytics as the Buddie AI web embed.

## Chrome Web Store listing (draft)

**Title:** Buddy AI – Emotional Safety for AI Chats

**Short description:** Add emotional eyes to any AI chat. Real-time mood detection and EU AI Act–ready compliance.

**Full description:**

> Add emotional eyes to any AI chat. Buddy AI detects real-time emotional safety and keeps you compliant. Works with ChatGPT, Claude, and Gemini. 14-day trial. EU AI Act ready.
>
> • Floating Buddy orb that mirrors conversation tone  
> • License-backed verify API — same as the web widget  
> • Mood analytics in your Buddie AI dashboard  
> • No CDN dependency — widget runs locally inside the extension  
> • Premium dark UI built to feel native on every platform  

**Category:** Productivity  
**Privacy:** License key stored locally; mood events sent to your Buddie AI account only.

## Get a license

1. Sign up at [www.buddieai.com/login](https://www.buddieai.com/login) (Google sign-in — no password needed)
2. Open your dashboard at [www.buddieai.com/dashboard](https://www.buddieai.com/dashboard)
3. Copy your license key into the extension popup  

## Build widget vendor bundle

From `dashboard/`:

```bash
npm run build:extension
```

This runs `build:widget` and copies `livingface-widget.js` + `buddy-widget.css` into `browser-extension/vendor/`.

Regenerate toolbar icons (optional):

```bash
node browser-extension/scripts/create-icons.mjs
```

## Load unpacked (development)

1. Open `chrome://extensions`  
2. Enable **Developer mode**  
3. **Load unpacked** → select this `browser-extension/` folder  

## Configure

1. Click the **Buddy AI** toolbar icon  
2. Paste your license key → **Save**  
3. Green **Active** = verified via `GET /api/licenses/verify?key=…&domain=extension`  
4. Open ChatGPT, Claude, or Gemini — orb appears bottom-right  

## Verify analytics

- Popup **Moods today** → `GET /api/extensions/stats?licenseKey=…`  
- Dashboard → **Emotional Analytics** should show incoming mood events  

## Architecture

| File | Role |
|------|------|
| `content.js` | Injects bundled widget on AI chat pages |
| `buddy-extension-init.js` | Calls `window.BuddyAI.init({ licenseKey, … })` in page context |
| `vendor/livingface-widget.js` | Minified widget (no remote CDN — avoids CSP) |
| `popup.js` | License storage, verify + stats |
| `background.js` | Install defaults + messaging |

## Supported origins

- `https://chat.openai.com/*`  
- `https://chatgpt.com/*`  
- `https://claude.ai/*`  
- `https://gemini.google.com/*`  

## Submission checklist

- [ ] Icons present (`assets/icons/icon16|48|128.png`)  
- [ ] `vendor/livingface-widget.js` built from latest `widget-lib`  
- [ ] Privacy policy URL on buddieai.com  
- [ ] Screenshots (ChatGPT + popup Active state)  
- [ ] Store listing copy above  
