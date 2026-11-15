# Karen — Google Play Store (Capacitor Android)

## Architecture note (CRITICAL)

**Do NOT set `output: 'export'` in `next.config.mjs`.**

Static export cannot ship:

- `/api/*` (Karen chat, TTS, Lemon webhooks)
- Server Actions (VIP checkout)
- NextAuth / middleware
- Prisma

Those are required for a working $19 VIP product.

Instead, Capacitor’s WebView loads the **hosted** Next.js app:

- `capacitor.config.ts` → `server.url` (e.g. `https://www.buddieai.com`)
- `webDir: 'out'` holds a tiny bootstrap page from `npm run cap:prepare`

## Packages (already in package.json)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/local-notifications
```

Init was already done as:

- App name: `Karen`
- App id: `com.yourcompany.karen`
- webDir: `out`

## One-time Android project

```bash
cd "C:\Users\Dell\Desktop\ai face sass\dashboard"
npm install
npm run cap:prepare
npx cap add android
npx cap sync android
npx cap open android
```

Optional env (WebView target):

```bash
# .env.local
CAPACITOR_SERVER_URL=https://www.buddieai.com
```

## Daily sync → Android Studio → `.aab`

```bash
cd "C:\Users\Dell\Desktop\ai face sass\dashboard"
npm run build
npm run cap:sync
# equivalent:
#   npm run cap:prepare
#   npx cap sync android
npx cap open android
```

### Generate signed App Bundle in Android Studio

1. Wait for Gradle sync.
2. **Build → Generate Signed Bundle / APK…**
3. Select **Android App Bundle** (`.aab`).
4. Create or choose an upload keystore — **back up keystore + passwords offline**.
5. Build **release**.
6. Upload `android/app/release/app-release.aab` (path may vary) in [Play Console](https://play.google.com/console).

### Native alarms

`hooks/useNativeAlarm.ts` + `@capacitor/local-notifications` schedule Karen’s wake call on-device (works when the WebView is backgrounded).

## Lemon Squeezy env (Vercel + local)

See `.env.example`:

| Variable | Purpose |
|---|---|
| `LEMONSQUEEZY_API_KEY` | Checkout API |
| `LEMONSQUEEZY_STORE_ID` | Store |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | HMAC verify |
| `LEMONSQUEEZY_KAREN_VIP_VARIANT_ID` | $19 Karen VIP variant |
| Buddy variants | Starter / Pro / Premium (existing) |

Karen webhook URL: `https://www.buddieai.com/api/webhooks/lemonsqueezy`
