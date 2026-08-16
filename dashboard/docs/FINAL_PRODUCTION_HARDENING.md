# Final production hardening audit (2026-08-16)

Hardening applied on top of `2c93c10`:

- Production env fail-fast (`lib/env.ts` + `instrumentation.ts`)
- Lemon webhook claim → apply → release-on-retryable
- Trusted client IP for analytics rate limits
- Document CSP + HSTS includeSubDomains
- Canonical `https://www.buddieai.com` for metadata / Lemon redirects
- Clean `.env.example` with REQUIRED / OPTIONAL / LOCAL sections

Historical empty SQLite blob: non-sensitive residue; no history rewrite.
