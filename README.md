# BuddieAI

Production SaaS companion product (orb, onboarding, dashboard, Lemon Squeezy billing).

## Repository layout

| Path | Purpose |
|------|---------|
| `dashboard/` | **Production Next.js app** (Vercel root directory) |
| `browser-extension/` | Chrome extension assets |
| `desktop-overlay/` | Desktop companion |
| `mobile/` | Mobile / live activity notes |
| `docs/` | Architecture / security audits |

## Production deploy (Vercel)

1. Connect this GitHub repository.
2. Set **Root Directory** to `dashboard`.
3. Build command: `npm run build` (default).
4. Copy env **names** from `dashboard/.env.example` into Vercel Project Settings → Environment Variables.  
   **Never commit real values.**
5. Required production vars include:
   - `DATABASE_URL` / `POSTGRES_URL`
   - `NEXTAUTH_URL` = `https://www.buddieai.com`
   - `NEXTAUTH_SECRET`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   - `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET`
   - `LEMONSQUEEZY_STARTER_VARIANT_ID`, `LEMONSQUEEZY_PRO_VARIANT_ID`, `LEMONSQUEEZY_PREMIUM_VARIANT_ID` (or agency)
6. Point Lemon Squeezy webhook to:  
   `https://www.buddieai.com/api/lemonsqueezy/webhook`
7. After first deploy, run additive schema sync from a secure environment:  
   `cd dashboard && npx prisma db push`  
   (no reset / no destructive migrate).

## Local development

```bash
cd dashboard
cp .env.example .env.local
# fill empty values locally — do not commit .env.local
npm install
npx prisma db push
npm run dev
```

Quality checks:

```bash
cd dashboard
npm run typecheck
npm run lint
npm test
npm run build
```

## Security

- Secrets live only in Vercel / local `.env.local` (gitignored).
- Tracked template: `dashboard/.env.example` (names only, empty values).
- Do not commit `.env*`, `*.pem`, `*.key`, credential JSON, or service-account files.

## Docs

- `dashboard/docs/RELEASE_REPORT.md` — production gate status
- `dashboard/docs/PERFORMANCE.md` — mobile performance notes
- `dashboard/README.md` — app-level routes and widget notes
