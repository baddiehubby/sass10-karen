# BuddieAI — Security Audit & Remediation

**Date:** 2026-08-16  
**Scope:** `sass face/dashboard` (production app)  
**Rule:** Secret values are never printed in this report.

---

## 1. Secret scan summary

| Check | Result |
|--------|--------|
| Tracked `.env` / `.env.local` / `.env.production` | **None** (only `.env.example`) |
| Working-tree automated pattern scan | **0 hits** (placeholders excluded) |
| `NEXT_PUBLIC_*` secret leakage | **None** — only public URLs/flags/DSN |
| `next.config.mjs` env secret exposure | **None**; `productionBrowserSourceMaps: false` |
| Accidental secret files to untrack | **None currently tracked** |

### Historical finding (Git history)

| SECRET TYPE | FILE | LINE | RECOMMENDED ROTATION |
|-------------|------|------|----------------------|
| Hardcoded debug-auth shared secret (legacy) | `dashboard/app/api/debug-auth/route.ts` (historical commits) | ~6 | **Rotate/invalidate** any value previously used as `DEBUG_AUTH_SECRET` or the old hardcoded probe secret. Ensure production never sets `DEBUG_AUTH_SECRET` unless intentionally needed in non-prod. |

**Current code:** debug route returns 404 in production and requires env secret in non-prod — no hardcoded value.

### History remediation (required ops step — not auto-run)

Do **not** force-push without an explicit ops decision. Recommended:

1. Rotate the historical debug secret / any credentials that may have been set to the old value.
2. Optionally purge history with `git filter-repo` / BFG targeting that file’s old content, then force-push all branches/tags and invalidate caches.
3. Confirm GitHub secret scanning alerts are cleared.

---

## 2. Fixes applied in this gate

| Area | Change |
|------|--------|
| Widget mood IDOR | POST requires `licenseKey` only; GET requires key or session ownership |
| Domain binding | Bound licenses reject missing/mismatched `domain` (verify + theme) |
| Lemon entitlements | Plan from **variant id only** — custom `tier` cannot upgrade |
| Theme upload | PNG-only + magic-byte check (SVG XSS surface removed) |
| Auth cookies | `HttpOnly`, `SameSite=lax`, `Secure` in production, 14-day JWT session |
| Onboarding cookie | `httpOnly: true` + `secure` in production |
| Rate limits | Tighter limits for auth, webhook, widget mood |
| Prompt injection | Scrub common override phrases before local intelligence |
| Presence writes | Require header+body key match (min length); session owner still allowed |
| `.gitignore` | Expanded secret/credential patterns |

Webhook: signature verification + idempotent `lemonEventId` + status-authoritative revoke/activate retained.

---

## 3. Remaining residual risks

| Severity | Item | Notes |
|----------|------|--------|
| Medium | Embed license key = write capability | By design for companion overlay; treat keys as secrets; rotate on leak |
| Medium | Full-table sessionToken scan | Consent/analytics — scale/DoS; follow-up |
| Low | Sticky `isAdmin` JWT claim | Re-login after admin list change |
| Ops | History purge | Manual; see §1 |

---

## 4. Verification

Run from `dashboard/`:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

Security unit tests: `src/intelligence/security.test.ts`.

---

## 5. Operator checklist

- [ ] Confirm Lemon webhook secret is set only in server env
- [ ] Confirm `NEXTAUTH_SECRET` / OAuth secrets rotated if ever exposed
- [ ] Confirm `DEBUG_AUTH_SECRET` unset in production
- [ ] Confirm no `ALLOW_WIDGET_PROXY=1` in production
- [ ] Decide on git-history purge for legacy debug-auth secret
- [ ] Review license keys exposed in customer HTML as capability tokens
