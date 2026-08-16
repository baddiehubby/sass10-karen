# Runbook: Deployment rollback

## When to roll back
- Error rate spike after deploy
- `/api/ready` failing only on new deployment
- Billing/auth regressions confirmed

## Vercel rollback (typical)
1. Vercel → Project → Deployments → prior known-good → Promote / Rollback.
2. Confirm production URL serves previous build.
3. Smoke: `/api/health`, `/api/ready`, `/login`, `/dashboard` (authed).

## Git rollback (if needed)
1. Identify last good commit on `main`.
2. Revert or redeploy that SHA via CI — prefer forward-fix when safe.
3. Never force-push `main` without explicit approval.

## After rollback
- Replay any missed Lemon webhooks.
- Note incident + commit SHA in release notes.
