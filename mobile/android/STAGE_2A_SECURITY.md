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
   user/license IDs, PKCE challenge, state hash, and public-key binding.
3. `/api/licenses/widget-credential/mobile` verifies the code, PKCE, state,
   timestamp, nonce, and ECDSA device proof.
4. The server returns a 14-day refresh credential bound to the public key and a
   credential version derived from the user's password hash.
5. Every refresh requires a fresh timestamp, random nonce, and ECDSA proof.
6. Logout stops the service, clears AES-GCM ciphertext, and destroys the AES
   and signing keys.

Handoff and refresh JWE keys are domain-separated HMAC derivations from the
server-only NextAuth secret. Tokens use direct A256GCM encryption with fixed
issuer, audience, algorithm, type, and expiry checks. Actual credentials must
never be copied into bug reports.

The no-Prisma bridge is stateless. It cannot mark a code/token as consumed or
revoke one device server-side. Hardware proof prevents a stolen credential
from being used without the device key; timestamps limit proof replay. Password
changes and account deletion invalidate refresh. Strict single-use/per-device
revocation requires an approved durable datastore.

## Endpoint review

- `POST /api/companion/sync/mobile-handoff` requires the existing verified
  NextAuth session and never trusts a client user ID.
- `POST /api/licenses/widget-credential/mobile` is reachable through the
  existing public widget-credential middleware namespace, but fails closed
  unless cryptographic handoff/refresh validation succeeds.
- Responses use `Cache-Control: no-store`.
- Errors are generic and contain no credential material.

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
- Confirm `/pwa` still mounts one Buddie and all protected web systems remain
  unchanged.
