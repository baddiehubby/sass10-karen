# BuddieAI — Architecture Audit

**Audit date:** 2026-08-15  
**Ship root:** `sass face/` (GitHub `baddiehubby/NEW_REPO`)  
**App root:** `sass face/dashboard/`  
**HEAD at audit start:** `ca827c8` (Living Buddy release)  
**Critical finding:** remote commits after rebase had overwritten `dashboard/lib/auth.ts` with middleware source — NextAuth `authOptions` missing until restored (see §13 / migration).

This document is evidence-based. No secrets are included.

---

## 1. Current architecture

| Layer | Implementation |
|--------|----------------|
| Framework | Next.js **14.2** App Router, React **18**, TypeScript |
| Styling | Tailwind **4**, cosmic CSS (`app/globals.css`) |
| Auth | NextAuth **v4.24** — Google + Credentials (`lib/auth.ts`, `app/api/auth/[...nextauth]`) |
| DB | Prisma **5.22** + PostgreSQL (`prisma/schema.prisma`) |
| Billing | Lemon Squeezy checkout + HMAC webhook; `License` is entitlement source of truth |
| Commercial code model | **Starter $20 / Pro $35 / Premium $99** (`lib/pricing-plans.ts`) |
| Middleware | JWT for private `/api/*` + `/dashboard*`, consent gate, rate limits, tenant cookie, security headers |
| PWA | `@ducanh2912/next-pwa`, `public/manifest.json`, Workbox + `shadow-companion-sw.js` |
| Deploy | Vercel (`vercel.json`), canonical `https://www.buddieai.com` (`lib/site-url.ts`) |
| Observability | Sentry (`@sentry/nextjs`) |
| Validation | Zod (`lib/validation.ts`) |

**Clients / siblings**

| Package | Role |
|---------|------|
| `dashboard/` | Primary web SaaS |
| `browser-extension/` | Chromium MV3 bridge to AI sites |
| `desktop-overlay/` | Electron always-on-top orb |
| `mobile/` | Android TWA/widget + iOS Live Activity **stubs** |

**Intelligence today:** almost entirely **local / deterministic** (Sentiment.js widget, mood heuristics, oracle templates, soul rules). **No OpenAI/Anthropic chat completion routes** found in the ship tree.

---

## 2. Existing functionality

| Surface | Status |
|---------|--------|
| Marketing / immersive homepage | Implemented (`components/immersive-homepage.tsx`, Three.js `CinematicOrb`) |
| Login / register | Google CTA + credentials APIs |
| Dashboard home | Living Orb (`BuddyOrb` CSS), rituals, portals to Mood/Oracle |
| Mood Universe | `/dashboard/mood` — localStorage check-ins, constellation, vibe labels |
| Oracle Realm | `/dashboard/oracle` — deterministic local engine |
| Settings | Companion name/personality (server) + vibe/aura/motion (device) |
| Widget embed | `public/widget/livingface-widget.js` + verify/theme/mood APIs |
| Lemon pricing UI | `/pricing` three paid tiers |
| Consent / EIData / Debiopwr | Consent flows + anonymized analytics pipelines |
| Buddy Soul APIs | `/api/buddy/*` — soft-fail if Soul tables missing (`P2021`/`P2022`) |
| Companion sync | `/api/companion/sync` config payload |
| PWA orb | `/pwa` |

---

## 3. Broken / incomplete functionality

1. **Auth file corruption (critical, now restored in working tree):** `lib/auth.ts` on `main` had been replaced with a copy of middleware (no `authOptions`). That breaks every `getServerSession(authOptions)` import.
2. **Lemon checkout 501** when store/variant env vars are unset (`create-checkout`).
3. **Presence APIs blocked by middleware JWT** while routes authenticate via **license key** (`/api/presence/*` not in public allowlist).
4. **Soul tables** may be absent in production Postgres — APIs degrade to `available: false`.
5. **Collab dashboard** still filters `plan: "agency"` while product naming is Premium.
6. **Messages** = welcome-email inbox, not companion chat.
7. **Empty legacy folders** `app/api/stripe`, `app/api/payments` (no routes).
8. **Mobile packages** are stubs, not store-ready.
9. **Parent workspace** `ai face sass/dashboard` contains **merge conflict markers** in auth/middleware — do not deploy that tree.
10. Marketing copy (“talks with you”) oversells vs current non-LLM companion loop.

---

## 4. Security risks

| Risk | Severity | Notes |
|------|----------|--------|
| Auth module overwritten | Critical | Fixed in working tree by restoring `auth.ts` from `ffa2614` |
| License key as bearer for widget/mood | Medium | By design for embeds; keys must stay private |
| Widget mood force with key only | Medium | Anyone with key can POST forced mood |
| Weak Edge rate limits | Medium | In-memory per isolate |
| Document CSP skipped | Low | API responses get CSP; HTML documents do not |
| Aggressive PWA caching | Medium | Stale client risk |
| Historical hardcoded debug secret in git | High (historical) | Mitigated: prod 404 unless `DEBUG_AUTH_SECRET`; never hardcode |
| Push check-in IDOR | High (fixed previously) | Ownership check required for session path |
| Webhook `custom_data.tier` preferred over variant | Medium | Prefer variant ID for entitlements |

---

## 5. UX problems

- First viewport previously cluttered (improved: extras behind “More”).
- Premium positioning vs perpetual internal `plan: "free"` bootstrap license (account scaffold, not marketed tier — still confusing in Settings).
- B2B surfaces (collab/analytics/outreach) sit beside Living Buddy rooms.
- Heavy Three.js orb on homepage vs lightweight CSS dashboard orb (two visual systems).
- Login privacy badge contrast may be low on dark gradients.
- Oracle/Mood require auth; cannot demo full loop without sign-in.

---

## 6. iPhone-specific problems

- `viewportFit: "cover"` + Apple web app meta present; **safe-area** not applied consistently on dashboard chrome.
- iOS install path is manual (“Add to Home Screen”) via `pwa-install.ts`.
- Web Push on iOS only for installed PWA (16.4+); presence cron still JWT-blocked for license clients.
- Live Activity code is a stub.
- Dynamic Island / home indicator: incomplete safe-area padding on orb screens.

---

## 7. Android-specific problems

- TWA + mood widget are templates/stubs.
- `beforeinstallprompt` is Chrome-oriented.
- Extension is Chromium MV3; no first-class Firefox/Android packaging.
- Desktop Electron overlay is not an Android path.

---

## 8. Desktop-specific problems

- Electron overlay depends on `/api/presence` — currently middleware-blocked without session cookie.
- Three.js + HDR environment on marketing/login is GPU-heavy on integrated graphics.
- Mouse-driven homepage orb is weak for trackpad / no-hover.
- Capture-exclusion helpers are OS-specific and fragile.

---

## 9. Billing problems

| Topic | Detail |
|-------|--------|
| Intended SKUs | Starter **$20**, Pro **$35**, Premium **$99** |
| Env wiring | `LEMONSQUEEZY_STARTER_VARIANT_ID`, `_PRO_`, `_PREMIUM_` / Agency alias |
| Checkout | Returns **501** until variants + API key + store resolve |
| Source of truth | Server `License.plan` + webhook — not `session.user.plan` |
| Free license | Auto-created for account bootstrap — **must not** be marketed as freemium |
| Dual matrices | `feature-plans.ts` (widget/SaaS) + `buddy-entitlements.ts` (Living Buddy caps) |
| Legacy | `agency` / `enterprise` webhook mapping retained |

---

## 10. Authentication problems

| Topic | Detail |
|-------|--------|
| NextAuth | Must export `authOptions` from `lib/auth.ts` (restored from `ffa2614`) |
| Google OAuth | Env-driven; callback pinned to www canonical URL |
| Credentials | Enabled; login UI is Google-primary |
| `eidataConsentCompleted` | In schema + middleware consent redirect; P2022 fallback in auth if column missing |
| `NEXTAUTH_SECRET` | Required in production (`NO_SECRET` if missing) |
| CSRF / state | Must remain enabled — do not weaken for P2022 |

---

## 11. Intelligence-routing problems ($0 Buddie inference)

| Path | Mechanism | Cost |
|------|-----------|------|
| Widget mood | On-device Sentiment.js | $0 |
| Mood Universe | LocalStorage + heuristics | $0 |
| Oracle | Seeded templates | $0 |
| Orb state | Pure derivation | $0 |
| Soul | Rule engine + DB | $0 (no LLM) |
| Chat LLM | **Not implemented** | N/A |

**Gap:** Pricing/marketing implies conversation; there is **no** metered chat lane yet. Correct $0 strategy: keep rituals/oracle/mood local; add optional entitled chat later behind flags and rate limits.

---

## 12. Performance problems

- Dual orb stacks (Three.js marketing vs CSS dashboard).
- Large deps: three/drei, chart.js, jspdf, framer-motion, MDX.
- Aggressive PWA front-end caching.
- Middleware on almost all non-static paths.
- Particles/confetti on celebration paths.
- Oracle is client-bundled (not separately lazy-split).

---

## 13. Production blockers

1. **Ensure `lib/auth.ts` is real NextAuth** on GitHub `main` (corruption must be committed/pushed).
2. Vercel: `NEXTAUTH_SECRET`, Google OAuth, `DATABASE_URL`.
3. Lemon: create $20/$35/$99 products; set variant IDs.
4. Additive DB: `eidataConsentCompleted` if missing; Soul tables only when approved.
5. Middleware allowlist for license-key **presence** APIs.
6. Authenticated smoke: login → Buddy → Mood → Oracle → checkout.
7. Do not deploy conflicted parent `ai face sass/dashboard`.

---

## 14. Recommended architecture (premium companion, $0 Buddie inference)

```text
Clients: Web PWA · Extension · Overlay · Widget
                │
                ▼
     Edge: Session JWT  OR  License-key scoped routes
                │
   ┌────────────┼────────────┐
   ▼            ▼            ▼
 Local rituals  Postgres     Optional /api/chat
 mood/oracle    License      (entitled, metered)
 orb/soul       MoodEvent    BYO or provider
 ($0)           Soul tables  (future)
```

Principles:

- Orb + Mood + Oracle + evolution remain **deterministic / local-first**.
- Paid tiers unlock **depth/cosmetics/history**, not guilt or emotional dependency.
- Chat (if added) is explicit, rate-limited, never the default cost path.
- One user identity, one Buddy identity, one Lemon entitlement pipeline.

---

## 15. Migration plan

| Phase | Action | Risk |
|-------|--------|------|
| **0** | Restore & ship `lib/auth.ts`; verify build | Unblocks SaaS |
| **1** | Allowlist `/api/presence` for license-key auth | Unblocks overlay/SW |
| **2** | Additive SQL: consent column; optional Soul `db push` after review | No drops |
| **3** | Configure Lemon variants; webhook smoke | Checkout live |
| **4** | Align collab/filters to `premium`; hide dead stripe dirs | Cleanup |
| **5** | Soften “talks” copy until chat ships **or** add flagged chat | Product honesty |
| **6** | Lazy-load Three.js orb; keep CSS orb for dashboard | Perf |
| **7** | Mobile TWA / iOS after presence works | Clients |
| **8** | Single source of truth: ship from `sass face` only | Repo hygiene |

**Rules:** no `migrate reset`, no production `db push` without approval, no OAuth weakening, no secret commits.

---

## Foundational fixes applied in this stage

Documented in the same PR/worktree as this audit:

1. Restored `dashboard/lib/auth.ts` from last known good commit (`ffa2614`).
2. Middleware: allow `/api/presence` for license-key companions (route-level auth retained).
3. Collab access: accept `premium` / `enterprise` as well as legacy `agency`.

### Verification (this stage)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `tsx scripts/check-oracle-determinism.ts` | Pass |
| First-party unit test suite | None (health-check / oracle script only) |

**Deployable:** yes for this stage (auth restored + build green). Lemon variants and DB consent/Soul still required for full production.

---

*End of audit.*
