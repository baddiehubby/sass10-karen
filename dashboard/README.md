# Buddie AI Dashboard

Next.js app: users, license keys, **Lemon Squeezy subscriptions**, analytics, viral challenge PDFs, demo outreach queue, theme and widget customization APIs. The embeddable widget lives in **`widget-lib/`** and is copied to **`public/widget/`** on `npm run build` (via `prebuild`).

## Stack

- Next.js App Router + TypeScript + Tailwind  
- Prisma + SQLite (or your deployed DB URL)  
- NextAuth (credentials)  
- Lemon Squeezy Checkout + webhook  

## Environment

Create `.env.local` (or `.env`) with:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# Comma-separated admin emails — unlocks /dashboard/outreach
BUDDY_ADMIN_EMAILS=you@company.com

# Lemon Squeezy
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_PRO_VARIANT_ID=
LEMONSQUEEZY_AGENCY_VARIANT_ID=

# Optional: full URL to livingface-widget.js on your CDN (no trailing slash)
WIDGET_CDN_URL=

# Optional privacy-friendly analytics (loaded only after cookie consent)
NEXT_PUBLIC_ANALYTICS_URL=
NEXT_PUBLIC_ANALYTICS_DOMAIN=

# Sentry monitoring
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=

# Optional: allow /api/dev/widget outside development (not recommended in public prod)
# ALLOW_WIDGET_PROXY=1
```

## Run locally

From **`dashboard/`**:

```bash
npm install
npx prisma db push
npm run build:widget   # once, if you need /api/dev/widget before a full build
npm run dev
```

## Widget URLs

| Mode | Embed `src` |
|------|-------------|
| **Development** | If `WIDGET_CDN_URL` is unset: `{NEXTAUTH_URL}/api/dev/widget` (serves `widget-lib/dist/livingface-widget.js`). |
| **Production** | Set `WIDGET_CDN_URL` to your CDN, or rely on same-origin `{NEXTAUTH_URL}/widget/livingface-widget.js` after `npm run build` (prebuild copies into `public/widget/`). |

## Routes (summary)

- `POST /api/auth/register`, `POST /api/auth/login` — auth  
- `GET /api/licenses/generate` — create license (session)  
- `GET /api/licenses/verify?key=...&domain=...` — public verify + features (CORS)  
- `GET /api/dev/widget` — dev (or `ALLOW_WIDGET_PROXY=1`): streams `widget-lib/dist`  
- `GET/POST /api/licenses/theme*`, `POST /api/licenses/widget-config` — theme & widget UI  
- `POST /api/analytics/event`, `GET /api/analytics/export` — analytics  
- `POST /api/widget/mood` — public mood override  
- `POST /api/lemonsqueezy/create-checkout`, `POST /api/lemonsqueezy/webhook` — subscriptions  
- `GET /api/challenge/report` — challenge PDF (session + license)  
- `POST /api/outreach/send` — demo outreach queue (admin only)  
- `GET /privacy`, `GET /terms`, `GET /blog`, `GET /product-hunt` — launch readiness pages

## Widget embed snippet

Use the URL from `getWidgetScriptUrl()` (dashboard shows **Copy embed code**):

```html
<script src="YOUR_WIDGET_SCRIPT_URL" data-hq-key="YOUR_LICENSE_KEY" async></script>
```

## Vercel

Set the Vercel project **Root Directory** to **`dashboard`**. Use the **default** build command (`npm run build`) and default output—no extra settings. See the repository root **`README.md`** for the full deployment checklist.
