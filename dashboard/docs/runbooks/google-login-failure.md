# Runbook: Google login failure

## Symptoms
- Users cannot Continue with Google
- Login card shows OAuth error
- Logs: `auth.failure` with `oauth_unverified` or `oauth_provision_failed`

## Immediate checks
1. Confirm `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set in Vercel (both or neither).
2. Confirm Google Cloud Console authorized redirect URI is exactly:
   `https://www.buddieai.com/api/auth/callback/google`
3. Confirm `NEXTAUTH_URL=https://www.buddieai.com`
4. Search logs for `x-request-id` from a failing attempt — never ask users for passwords.

## Mitigations
- Unverified Google emails are rejected by design — ask user to verify Google account email.
- Provisioning failure denies login fail-closed — check DB connectivity via `/api/ready`.

## Escalate
- If redirect URI mismatch: update Google Console (do not paste secrets in tickets).
- If DB not ready: follow database outage runbook.
