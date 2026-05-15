# Buddy AI Chrome Extension

Injects the Buddy AI emotional safety orb into **ChatGPT**, **Claude**, and **Gemini** using the same widget bundle as the web embed.

## Build widget vendor files

From `dashboard/`:

```bash
npm run build:widget
```

This copies `livingface-widget.js` and `buddy-widget.css` into `browser-extension/vendor/`.

## Load unpacked in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `browser-extension/` folder

## Configure

1. Click the Buddy AI toolbar icon
2. Paste your license key from [app.buddieai.com](https://app.buddieai.com/dashboard)
3. Click **Save** — status should show green **Active**
4. Open a chat on ChatGPT, Claude, or Gemini — the orb appears bottom-right

## Verify analytics

- Extension popup shows **Moods today** from `GET /api/extensions/stats`
- Dashboard **Emotional Analytics** should receive mood events from the widget

## Supported URLs

- `https://chat.openai.com/*`
- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`
