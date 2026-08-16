# Runbook: Domain outage

## Symptoms
- `www.buddieai.com` unreachable or TLS errors
- DNS resolution fails
- Apex `buddieai.com` does not redirect to www

## Immediate checks
1. External DNS lookup for `www.buddieai.com` and apex.
2. TLS certificate validity / expiry.
3. Vercel domain assignment and DNS records.
4. Status of CDN / DNS provider.

## Mitigations
1. Restore DNS to documented production records (www → Vercel).
2. Keep OAuth redirect URI on www — do not switch Google callback to apex mid-incident without coordinated Console change.
3. Lemon webhook URL must remain on the canonical www host.

## Communication
Status page / support: avoid sharing internal IPs or panel credentials.
