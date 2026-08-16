# Buddie AI Dashboard

Next.js App Router production app: companion home, onboarding, licenses, **Lemon Squeezy** billing, analytics, and the embeddable widget (`widget-lib/` → `public/widget/` on build).

## Stack

- Next.js 14 + TypeScript + Tailwind  
- Prisma + Postgres (Vercel)  
- NextAuth (Google OAuth)  
- Lemon Squeezy checkout + signed webhooks  

## Environment

Copy **`/.env.example`** → **`.env.local`** and fill values locally.

```bash
cp .env.example .env.local
```

Use the variable **names** in `.env.example` only. Never commit real secrets.  
Canonical names (must match code / Vercel):

- `DATABASE_URL`, `POSTGRES_URL`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_STORE_ID`
- `LEMONSQUEEZY_STARTER_VARIANT_ID`, `LEMONSQUEEZY_PRO_VARIANT_ID`, `LEMONSQUEEZY_PREMIUM_VARIANT_ID`

See the full empty template in `.env.example`.

## Run locally

```bash
npm install
npx prisma db push
npm run build:widget   # optional before full build
npm run dev
```

## Quality

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Billing

- Checkout: `POST /api/lemonsqueezy/create-checkout` (session required)
- Webhook: `POST /api/lemonsqueezy/webhook` (HMAC signature + idempotent claims)
- Status / soft sync: `GET /api/billing/status`, `POST /api/billing/sync`
- Paid entitlements come from verified webhooks / Subscription rows — never from `?paid=true`

## Vercel

Set project **Root Directory** to **`dashboard`**. Default `npm run build`. Configure env vars from `.env.example` in the Vercel UI only.
