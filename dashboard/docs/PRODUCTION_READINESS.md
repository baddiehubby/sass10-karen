# BuddieAI — Production Readiness Audit Report

**Date:** 2026-08-16  
**Scope:** Full repository audit + harden (no architecture rewrite)  
**App root:** `sass face/dashboard`  
**Verdict:** **NOT production-ready** — ops CRITICAL blockers remain (Lemon live config, schema push, device QA). Code-side CRITICAL auth/billing issues found in this audit were fixed and verified.

---

## PRODUCTION READINESS SCORE

| Area | Score | Notes |
|------|------:|-------|
| Security | **7/10** | Auth takeover path closed; HMAC session tokens; API CSP; Edge rate limits still in-memory |
| Authentication | **8/10** | Google `email_verified`; password rotate on Google attach; consent fail-closed; admin from env |
| Payments | **7/10** | Apply-then-claim webhooks; `unknown` no longer grants; live Lemon smoke still required |
| Database | **6/10** | Schema ready; production needs additive `db push` (`Subscription`, `widgetSessionToken`) |
| Mobile UX | **7/10** | CSS-first orb; safe storage; early CTA; footer always reachable |
| iOS UX | **6/10** | Policy-correct; **device QA not completed** this gate |
| Android UX | **6/10** | Policy-correct; **device QA not completed** this gate |
| Performance | **7/10** | PWA less aggressive; fonts swap; lab Lighthouse only |
| Reliability | **7/10** | Soft-fail companion talk; billing sync preserve; no distributed rate limit |
| Accessibility | **6/10** | Basic landmarks/links; no full a11y audit |
| SEO | **7/10** | Sitemap excludes private routes; robots Host → www |
| Deployment | **5/10** | Build green; **ops env + schema + live smoke blocked** |

**Overall:** **6.5 / 10** — ship only after BLOCKERS cleared.

---

## Verification (this gate)

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run test` (83) | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Secret scan (tracked / `.env.example`) | PASS — names/placeholders only; `.env*` gitignored |
| Client secret leakage in build | PASS — no env *assignments* or live keys; jose PEM *format strings* (`BEGIN PRIVATE KEY`) are library templates, not secrets |

---

## Fixes applied this audit

### CRITICAL

1. **Google + pre-registered email account takeover**  
   - *Why:* Attacker registers victim email + password; victim Google-signs-in onto same User while attacker keeps credentials.  
   - *Fix:* Require Google `email_verified`; on Google attach **rotate password** to unusable random hash; fail closed without verified email.

2. **Weak widget session token + full-table license scan**  
   - *Why:* 32-bit FNV tokens + `findMany` all licenses → collision/DoS.  
   - *Fix:* HMAC `bdy_` tokens; Prisma `widgetSessionToken` unique index; capped legacy fallback + backfill.

3. **Webhook claim-before-apply poison**  
   - *Why:* Crash after claim, before apply → event ID permanently ignored.  
   - *Fix:* Apply then record (idempotent upserts); duplicates still short-circuit via `hasProcessedEvent`.

### HIGH

4. JWT consent defaulted open → **fail closed (`?? false`)**; admin recomputed from env; claims refresh ~6h.  
5. `unknown` Lemon status no longer grants access.  
6. Verify / analytics / widget mood / consent status enforce **`isLicenseActive`**.  
7. Lemon webhook **exempt from IP rate-limit** before signature verify.  
8. Production **`NEXTAUTH_SECRET`** required at runtime (not during `next build` page collection).  
9. EIDATA salt / session HMAC fail-closed in production.  
10. Consent status uses indexed resolver (no full license table scan).  
11. PWA manifest / theme / apple title aligned to Buddie; homepage footer always visible; memory-session whisper; sitemap excludes dashboard/auth.

---

## BLOCKERS (must clear before calling production-ready)

1. **Lemon Squeezy production env on Vercel** — real `LEMONSQUEEZY_*` API key, webhook secret, store id, and **Starter / Pro / Premium variant IDs** (do not invent).  
2. **Live smoke:** checkout → webhook → entitlement unlock → refresh still paid.  
3. **`prisma db push` (or migrate) on production DB** — apply additive `Subscription` + `License.widgetSessionToken` (and any prior additive columns).  
4. **Confirm production secrets:** `NEXTAUTH_SECRET`, `EIDATA_HASH_SALT`, Google OAuth, `DATABASE_URL` / `POSTGRES_URL`.  
5. **Device QA:** real iPhone Safari + Android Chrome (install PWA, storage-denied path, talk, checkout return).

---

## HIGH PRIORITY

- Replace Edge in-memory rate limits with Redis/Upstash (or Vercel KV) for multi-instance enforcement.  
- Email verification for credentials registration (reduces squatting / support load).  
- Document CSP strategy for document routes (API CSP only today; pages rely on Next defaults + other headers).  
- Backfill `widgetSessionToken` for all active licenses after schema push.  
- Confirm Lemon webhook URL is `https://www.buddieai.com/api/lemonsqueezy/webhook` with signing secret matching Vercel.

---

## MEDIUM PRIORITY

- Distributed idempotency monitoring for webhooks (alerts on ignore/stale rates).  
- OG/social image polish for marketing pages.  
- Full WCAG pass (focus order, contrast, reduced-motion).  
- Sentry client config migration warning (`instrumentation-client.ts`).  
- Remove or further gate any remaining public debug/dev surfaces.

---

## OPTIONAL

- Trim widget bundle size.  
- Prisma major upgrade (5 → 7) when ready.  
- Stronger analytics consent UX copy.  
- Lighthouse CI in GitHub Actions.

---

## Explicit non-claims

- **Do not declare production-ready** while any BLOCKER above remains.  
- Intelligence plumbing stays invisible to users; Soul Engine remains the default product path.  
- No secrets were committed; local `.env.local` was not deleted.
