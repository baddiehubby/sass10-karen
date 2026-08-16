# BuddieAI — Red Team Security Audit

**Date:** 2026-08-16  
**Assumption:** Attacker has public site + browser DevTools.

## Verdict

Classic **cross-user IDOR** on memories/garden/alerts/billing was **not** found (session + ownership checks). Real HIGH issues were fixed in this pass. Fake paid via query/body remains blocked (webhook HMAC + variant-only plan).

## Fixed this pass

| Severity | Issue | Fix |
|----------|--------|-----|
| HIGH | Open redirect via `register?returnUrl=` | `safeAppPath` / `isSafeRelativePath`; wired into register + NextAuth redirects |
| HIGH | License domain spoof via query `domain=` | Origin/Referer preferred (`assertLicenseDomainFromRequest`) on verify/theme/mood/presence |
| HIGH | Anonymized ingest full-table license scan | Indexed `resolveLicenseForWidgetAuth` only |
| MEDIUM | Rate-limit bypass via leftmost `X-Forwarded-For` | `getTrustedClientIp` (x-real-ip / rightmost XFF) |
| MEDIUM | Register email enumeration + weak passwords | Generic 400; bcrypt pad; min password **10** |
| MEDIUM | Login timing + user id leak | Dummy bcrypt; no user object in response |
| MEDIUM | Owner CSS `@import` / expression | `sanitizeWidgetCss` on store + verify |

## Already solid

- Memory delete scoped by `userId` + `memoryId`
- Billing: no client paid flags; webhook HMAC + timing-safe compare
- Widget mood writes require `licenseKey` (not licenseId alone)
- Prompt injection scrub on local engine
- `debug-auth` 404 in production

## Residual risk (ops / follow-up)

- License **key** is still a capability token if leaked from an embed — rotate keys; keep domain binding on
- Edge rate limits remain in-memory (multi-instance) — prefer Redis/Upstash
- Concurrent webhook workers: upserts are idempotent; unique event id after apply

## Regression tests

`src/intelligence/redteam-security.test.ts` — open redirect, Origin domain binding, trusted IP, CSS sanitize, password strength, prompt scrub.

Run: `npm run test:security`
