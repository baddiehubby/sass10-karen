# Buddy AI Shadow Companion — Defensible Architecture

## Presence layers

| Layer | Path | Role |
|-------|------|------|
| Desktop overlay | `desktop-overlay/` | Always-on-top 120×120 orb (Electron) |
| Browser extension | `browser-extension/` | ChatGPT, Claude, Gemini |
| PWA + SW | `dashboard/public/shadow-companion-sw.js` | Background sync, push check-ins |
| Mobile | `mobile/android`, `mobile/ios` | TWA + widget / Live Activity stubs |
| Debiopwr | `/dashboard/debiopwr` | Founder analytics (admin only) |

## Desktop overlay

```bash
cd desktop-overlay
npm install
# Set license from dashboard Settings / embed key:
$env:BUDDY_LICENSE_KEY="HQ-..."; npm start
npm run pack:win   # or pack:mac → copy to desktop-overlay/dist/
```

- macOS: `setContentProtection(true)`
- Windows: `SetWindowDisplayAffinity` via `win-capture-exclude.js`
- Mood: `buddy-presence.json` in userData + `/api/presence/state`

## Emotional data (Debiopwr)

- **Never:** raw conversation text
- **With consent:** mood, timestamp, hashed session, region bucket, source platform
- **Prisma:** `UserConsent`, `AnonymizedMoodEvent`
- **Ingest:** `POST /api/eidata/anonymized-event` with `X-Buddy-Widget-Opt-In: yes`
- **Admin:** `BUDDY_ADMIN_EMAILS` + `EIDATA_HASH_SALT` in production

```bash
cd dashboard
npx prisma db push
npm run build
```

## User activation checklist

1. Sign in → **Settings → Granular consent** → grant anonymous analytics / model training as desired
2. **Dashboard home → Download desktop overlay**
3. Install Chrome extension or PWA (`/pwa`)
4. Open Debiopwr (founders) to confirm flywheel events
