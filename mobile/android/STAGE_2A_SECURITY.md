# Stage 2A security and release review

## Trust boundaries

- NextAuth authenticates only inside the existing HTTPS web application.
- Android is untrusted. It receives no cookie, password, license key, server
  secret, database credential, or payment-provider secret.
- Entitlement is evaluated by `getUserEntitlement()` during every native
  exchange/refresh. Local state is UI/cache state only.

## Credential lifecycle

1. Android creates a non-exportable P-256 signing key and PKCE verifier.
2. The signed-in web page requests a two-minute A256GCM-encrypted handoff code containing
   user/license IDs, PKCE challenge, state hash, and public-key binding. Its
   `jti` is persisted and can be consumed exactly once.
3. `/api/licenses/widget-credential/mobile` verifies the code, PKCE, state,
   timestamp, one-time device-bound nonce, and ECDSA device proof.
4. The server returns a 14-day refresh credential bound to the public key and a
   credential version derived from the user's password hash. Only a SHA-256
   hash of the high-entropy JWE is persisted.
5. Every refresh requires a fresh timestamp, random nonce, and ECDSA proof.
   Rotation atomically invalidates the old token; reuse revokes its family and
   device.
6. Logout requests server-side device revocation, stops the service, clears
   AES-GCM ciphertext, and destroys the AES and signing keys. Local cleanup is
   fail-closed when the network is unavailable.

Handoff and refresh JWE keys are domain-separated HMAC derivations from the
server-only NextAuth secret. Tokens use direct A256GCM encryption with fixed
issuer, audience, algorithm, type, and expiry checks. Actual credentials must
never be copied into bug reports.

The bridge uses additive PostgreSQL lifecycle state for one-time handoffs,
device registration/revocation, refresh families, and proof-nonce consumption.
No raw refresh credential or device fingerprint is stored. Password changes
and account deletion continue to provide global invalidation.

## Endpoint review

- `POST /api/companion/sync/mobile-handoff` requires the existing verified
  NextAuth session and never trusts a client user ID.
- `POST /api/licenses/widget-credential/mobile` is reachable through the
  existing public widget-credential middleware namespace, but fails closed
  unless cryptographic handoff/refresh validation succeeds.
- Responses use `Cache-Control: no-store`.
- Errors are generic and contain no credential material.
- Authentication, active-device validation, and paid entitlement are required
  before a companion credential or presence check-in is issued.

## Android review

- `android:usesCleartextTraffic="false"`; fixed production HTTPS endpoints have
  10-second connect and 15-second read timeouts.
- Refresh token ciphertext is under `noBackupFilesDir`; the AES and ECDSA keys
  are non-exportable Android Keystore entries.
- The auth callback is handled separately from destination deep links.
- The service is unexported, `specialUse`, visible, user-started,
  `START_NOT_STICKY`, and immediately removable.
- Overlay creation always checks `Settings.canDrawOverlays()`.
- No Accessibility Service, WebView overlay, screen capture, root, VPN,
  installed-app access, or hidden recovery component exists.

## Release gates

- Deploy the backend bridge before distributing the Android build.
- Run backend test/typecheck/build and Android unit/lint/debug/release builds.
- Run instrumented tests on API 26 and API 36.
- Complete the physical Pixel, Samsung, and Xiaomi/Redmi checklist.
- Review Google Play `specialUse` foreground-service and overlay declarations.
- Configure release signing outside Git.
- Apply `prisma/proposed-migrations/add_mobile_auth_lifecycle.sql` through the
  reviewed production database process before deploying the backend. The
  repository has no Prisma Migrate baseline, so do not treat this file as an
  automatically deployable migration.
- Confirm `/pwa` still mounts one Buddie and all protected web systems remain
  unchanged.
