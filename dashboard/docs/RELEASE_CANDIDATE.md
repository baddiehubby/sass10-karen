# BuddieAI — Final Release Candidate Gate

**Date:** 2026-08-16  
**Role:** Release manager (no new features / no redesign)  
**App root:** `sass face/dashboard`  
**Ship git root:** `sass face`  
**HEAD (committed):** `bb41daceb6cd18baea582251b2a5f3a5bba66929`  
**Working tree:** dirty — substantial uncommitted RC work (billing, security, soul, cost, docs)

## Verdict

# NOT PRODUCTION READY

---

## Production commands (this gate — executed, not fabricated)

| Command | Result |
|---------|--------|
| `npm run lint` | **PASS** — No ESLint warnings or errors |
| `npm run typecheck` | **PASS** |
| `npm run test` | **PASS** — 168 tests, 0 fail |
| `npm run build` | **PASS** — Next.js 14.2.35, exit 0 |
| `node scripts/health-check.mjs` | **PASS** — 4/4 against https://www.buddieai.com |
| Secret scan (build artifacts) | **PASS with note** — jose PEM *format* strings (`BEGIN PRIVATE KEY`) in chunks; not live secrets |

---

## Test matrix (evidence-based)

Legend: ✅ automated/code evidence · ⚠️ partial · ❌ not verified / missing · 🚫 ops/device not run here

### AUTH
| Item | Status | Evidence |
|------|--------|----------|
| signup | ⚠️ | Register route + validation tests; no E2E |
| login | ⚠️ | Credentials + Google providers in `lib/auth.ts`; health-check login page |
| logout | ⚠️ | NextAuth signOut paths exist; no E2E |
| session persistence | ⚠️ | JWT session strategy; not live-probed |
| expired session | ⚠️ | Middleware/session checks; no E2E |
| OAuth callback | ⚠️ | Google provider configured; needs live Google smoke |
| unauthorized request | ✅ | API auth patterns + redteam/security tests |
| account deletion | ❌ | **No delete-account API/UI** on account page |

### ONBOARDING
| Item | Status |
|------|--------|
| first visit / Sacred Day / awaken | ⚠️ code present |
| refresh / close-reopen | ⚠️ client storage patterns |
| mobile keyboard / slow / offline | 🚫 device QA not run |
| returning user | ⚠️ soul `returning` intent + tests |

### BUDDIE
| Item | Status |
|------|--------|
| greeting / conversation / memory / topic / anti-rep / local intel | ✅ unit/integration tests |
| deeper intelligence / cost routing / failure fallback | ✅ cost + soul tests; soft talk fallback |
| loading / retry | ⚠️ UI soft paths; no dedicated E2E |

### DASHBOARD
| Item | Status |
|------|--------|
| profile / memories / settings / subscription / logout | ⚠️ pages exist; no E2E |
| garden | ⚠️ verify route presence in app tree |

### PAYMENTS
| Item | Status |
|------|--------|
| webhook / duplicate / cancel / renewal / failure / expiration / refund | ✅ billing unit tests (168 suite includes Lemon cases) |
| checkout / successful subscription live | 🚫 **live Lemon smoke not run** |

### MOBILE / DESKTOP
| Item | Status |
|------|--------|
| iPhone Safari/Chrome, Android Chrome, Samsung Internet | 🚫 **not executed** |
| Chrome / Edge / Safari / Firefox desktop | 🚫 **not executed** (policy/code only) |

### SECURITY
| Item | Status |
|------|--------|
| user isolation / API auth / rate limit / XSS / injection / webhook sig / entitlement | ✅ unit + redteam tests |
| secret scan | ✅ names/placeholders; PEM format false-positives documented |
| entitlement manipulation | ✅ billing + security tests |

---

## BLOCKERS (must clear before PRODUCTION READY)

1. **Uncommitted RC tree** — HEAD `bb41dac…` does not include the hardened billing/security/soul/cost work; ship only after a deliberate release commit (or tagged SHA that contains it).
2. **Lemon Squeezy production env** — real API key, webhook secret, store id, Starter/Pro/Premium variant IDs on Vercel (do not invent).
3. **Live payment smoke** — checkout → webhook → entitlement unlock → refresh still paid.
4. **Production `prisma db push` (or migrate)** — `Subscription` + `License.widgetSessionToken` (and additive columns) applied to prod DB.
5. **Production secrets confirmed** — `NEXTAUTH_SECRET`, `EIDATA_HASH_SALT`, Google OAuth, `DATABASE_URL` / `POSTGRES_URL`.
6. **Device QA** — real iPhone Safari + Android Chrome (PWA, storage-denied, talk, checkout return).
7. **Account deletion** — matrix item missing (no erase/delete account path); required for full auth/compliance matrix.

---

## What was verified green (non-blocking for code quality)

- Lint / typecheck / 168 automated tests / production build
- Billing entitlement logic (unit): cancel-at-period-end, renew, past_due, refund, duplicate webhook, bad signature
- Security unit/redteam: redirects, domain binding, injection scrub, rate-limit helpers
- Soul + cost engineering: local-first, never-expensive intents, abuse caps
- Live site health-check homepage + login markers + widget asset

---

## Explicit non-claims

- Do **not** call production-ready while any BLOCKER above remains.
- Do **not** treat unit billing tests as live checkout proof.
- Do **not** treat HEAD SHA as the RC artifact while the working tree is dirty.
