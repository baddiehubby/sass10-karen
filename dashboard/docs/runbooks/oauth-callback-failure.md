# Runbook: OAuth callback failure

## Symptoms
- Redirect returns to `/login` with error query
- Users bounce after Google consent screen
- PKCE / state mismatch symptoms

## Immediate checks
1. Redirect URI exact match (www, https, path).
2. `NEXTAUTH_URL` and `NEXTAUTH_SECRET` present and stable across instances.
3. Cookies: Secure / SameSite in production (`lib/auth-cookies.ts`).
4. Clock skew unlikely on Vercel — still check if state expires immediately.

## Mitigations
1. Align env + Google Console.
2. Clear site cookies and retry once.
3. If PKCE/state errors persist after deploy: roll back auth-related change (deployment rollback runbook).

## Never
- Log or request user OAuth tokens.
- Disable `email_verified` check to “make login work.”
