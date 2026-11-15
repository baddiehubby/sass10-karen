# Buddie AI Dashboard (+ Karen VIP)

Next.js App Router production app: Buddy companion, onboarding, licenses, **Lemon Squeezy** billing, analytics, embeddable widget, and the **Karen** accountability coach (`/karen`).

## Stack

- Next.js 14 + TypeScript + Tailwind  
- Prisma + PostgreSQL  
- NextAuth (credentials / Google OAuth)  
- Lemon Squeezy (Buddy plans + Karen VIP $19/mo)  
- **TalkingHead 3D** — vendored from `Desktop/GLB/TalkingHead-main` → `vendor/talkinghead` (`@met4citizen/talkinghead`)  
- Capacitor Android shell (Play Store)  
- Optional local Ollama for Karen chat  

### TalkingHead (Karen avatar)

```bash
# Source of truth (already copied):
# vendor/talkinghead  ← Desktop/GLB/TalkingHead-main (+ playback-worklet.js)
# public/models/karen.glb
# public/talkinghead/playback-worklet.js
```

Re-sync from Desktop after upstream upgrades:

```bash
# PowerShell
Copy-Item -Recurse -Force "$env:USERPROFILE\Desktop\GLB\TalkingHead-main\modules\*" vendor\talkinghead\modules\
npm install
```


---

## Run locally

```bash
# 1) Install
npm install

# 2) Environment
cp .env.example .env.local
# Fill DATABASE_URL, NEXTAUTH_*, Lemon Squeezy keys, etc.

# 3) Database schema (dev / staging only — review before production)
npx prisma generate
npx prisma db push
# Karen VIP columns: see prisma/proposed-migrations/add_karen_vip_is_premium.sql

# 4) (Optional) Karen chat — run Ollama locally
# ollama serve
# ollama pull llama3.2
# Set in .env.local:
#   OLLAMA_BASE_URL=http://127.0.0.1:11434
#   OLLAMA_MODEL=llama3.2

# 5) Dev server
npm run dev
```

Open:

- Buddy dashboard: [http://localhost:3000](http://localhost:3000)  
- Karen: [http://localhost:3000/karen](http://localhost:3000/karen)  
- Karen alarm: [http://localhost:3000/karen/alarm](http://localhost:3000/karen/alarm)  

### Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

---

## Lemon Squeezy (billing)

Documented in **`.env.example`**. Required names:

| Variable | Purpose |
|---|---|
| `LEMONSQUEEZY_API_KEY` | Create checkouts |
| `LEMONSQUEEZY_STORE_ID` | Store for checkout API |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | HMAC verify webhooks |
| `LEMONSQUEEZY_STARTER_VARIANT_ID` | Buddy Starter |
| `LEMONSQUEEZY_PRO_VARIANT_ID` | Buddy Pro |
| `LEMONSQUEEZY_PREMIUM_VARIANT_ID` | Buddy Premium |
| `LEMONSQUEEZY_KAREN_VIP_VARIANT_ID` | Karen VIP ($19/mo) |

Webhook endpoints (configure both in Lemon if you use Buddy + Karen):

- Buddy: `POST /api/lemonsqueezy/webhook`  
- Karen VIP: `POST /api/webhooks/lemonsqueezy`  

Checkout: signed-in users use the Karen **Upgrade** modal → server action → Lemon hosted checkout.  
Entitlements come from **verified webhooks** only (never from `?paid=true`).

---

## Deploy to Vercel (Web)

1. Import the repo in [Vercel](https://vercel.com).  
2. Set **Root Directory** to `dashboard` (if the monorepo root is the parent folder).  
3. Build command: `npm run build` (default).  
4. Add **all** production env vars from `.env.example` in the Vercel project settings (never commit secrets).  
5. Attach a Postgres database (`DATABASE_URL`).  
6. After first deploy, apply pending Prisma / proposed SQL on production **only after review** (see `prisma/MIGRATION_PLAN.md` and `prisma/proposed-migrations/`).  
7. Point Lemon webhook URLs at your production domain.  
8. Set `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, and `NEXT_PUBLIC_APP_URL` to the production HTTPS origin.

---

## Build Android `.aab` (Play Store)

**Do not set `output: 'export'` in `next.config.mjs`.** Static export cannot ship `/api/*`, Server Actions, NextAuth, or Prisma — all required for Karen VIP + chat. Capacitor loads the **hosted** Next.js URL via `capacitor.config.ts` → `server.url`.

```bash
npm install
npm run build
# Prepare bootstrap out/ + sync native project (preferred script):
npm run cap:sync
# Or explicitly:
npx cap sync android
npx cap open android
```

Optional: `CAPACITOR_SERVER_URL=https://www.buddieai.com` (defaults to `NEXT_PUBLIC_APP_URL` / site URL).

### Signed App Bundle in Android Studio

1. Open the project via `npx cap open android`.  
2. Wait for Gradle sync.  
3. **Build → Generate Signed Bundle / APK…**  
4. Select **Android App Bundle** (`.aab`).  
5. Create or choose an upload keystore — **back up the keystore + passwords offline**.  
6. Build the **release** variant.  
7. Upload the `.aab` (typically under `android/app/release/`) in [Google Play Console](https://play.google.com/console).

More detail: [`docs/KAREN_PLAY_STORE.md`](docs/KAREN_PLAY_STORE.md).

---

## Useful paths

| Path | Description |
|---|---|
| `/karen` | Karen chat (Sweet demo → Sarcasm 10 VIP) |
| `/karen/alarm` | Wake-up alarm (web + native notifications) |
| `/api/karen/chat` | Streaming Ollama chat + VIP gating |
| `/api/webhooks/lemonsqueezy` | Karen VIP subscription webhooks |
| `lib/karen/` | Prompts, Ollama client, VIP helpers, native alarms |
| `widget-lib/` | Embeddable Buddy widget source |

---

## License / attribution

Buddy product code is proprietary unless otherwise noted.  
Third-party libs retain their licenses (e.g. MIT packages under `node_modules`).  
Karen interview methodology attribution: `lib/karen/interview/ATTRIBUTION.md`.
