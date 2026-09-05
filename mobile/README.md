# Buddie Native Companion

Buddie is one account, one entitlement system, one presence model, and one
Oracle exposed through platform-appropriate surfaces.

## Production core

The Next.js application in `dashboard/` remains the product and intelligence
core. Native clients are untrusted, thin presentation clients.

Existing canonical systems:

- Authentication: NextAuth
- Entitlement: `GET /api/billing/status` and server-side entitlement logic
- Companion configuration: `GET /api/extensions/bootstrap` and
  `POST /api/companion/sync`
- Presence: `GET/POST /api/presence/state`
- Scoped widget access: `POST /api/licenses/widget-credential`
- Oracle: `/dashboard/oracle`
- Billing: existing Lemon Squeezy checkout and webhook processing

Native clients must never ship server secrets or independently grant paid
access.

## Android

Android uses native Kotlin. Stage 2A implements the premium companion as a native
`WindowManager` overlay with explicit user permission and a user-visible
foreground service. It must be draggable, dismissible, accessible, and honest
when Android or an OEM stops it.

See `android/README.md` for authentication, permissions, testing, and
Android/OEM limitations.

## iOS

iOS does not provide a public Android-style arbitrary overlay over other apps.
Buddie will use a SwiftUI host, Home and Lock Screen widgets, App Intents,
notifications, and meaningful, user-started Live Activities/Dynamic Island
surfaces where supported.

The existing `ios/BuddyLiveActivity` source is a stub, not a buildable Xcode
project. iOS implementation and release validation require macOS, Xcode,
signing credentials, and physical-device testing.

## Android authentication integration

NextAuth currently issues an HTTP-only browser JWT cookie. Custom Tabs and
the system browser complete normal web login, but Android never extracts or
reuses that cookie. The approved bridge creates a two-minute PKCE/state/device-
key-bound authorization code and exchanges it for a device-bound refresh
credential. The bearer credential stays in Keystore-encrypted storage and is
never put in a URL.

The bridge reuses `/api/companion/sync` and
`/api/licenses/widget-credential` namespaces so protected middleware and auth
core remain unchanged. It calls the existing entitlement, companion, and
presence services server-side. No Prisma field or second account system is
introduced. Strict per-device server revocation remains gated on approval for
persistent server-side state.

## Store billing gate

Existing paid users can be recognized only through the server-authoritative
entitlement system. Upgrade links to external Lemon Squeezy checkout are
subject to Google Play and App Store storefront rules for digital services.
The native clients must not assume that an external Upgrade button is permitted
in every storefront. StoreKit/Play Billing strategy requires product and legal
approval before mobile monetization UI is shipped.

## Deep links

The intended native scheme is `buddieai://`, with allowlisted destinations for
open, Oracle, settings, and companion setup. Universal/App Links are deferred
until bundle IDs, package IDs, signing teams, and certificate fingerprints are
final. Sensitive values must never be included in links.

## Build and signing

- Android release signing is supplied outside source control.
- iOS signing is configured through the Apple Developer account and Xcode.
- Debug and release application identifiers/configurations must remain
  separated.
- No signing key, provisioning profile, secret, cookie, or production
  credential belongs in Git.

## Privacy and diagnostics

The basic companion does not require contacts, SMS, microphone, location,
Accessibility, Notification Listener, or installed-app inventory.

Diagnostics may record non-sensitive state names such as
`overlay_permission_missing` or `deep_link_failed`. They must never include
tokens, cookies, license keys, conversations, or private user data.

## Web protection

Mobile work must not alter production authentication, Lemon Squeezy, Prisma,
Oracle, Garden, or entitlement logic without an explicit integration review.
Phase 1 commit `0ace014` must remain intact, including the `/pwa` condition
that prevents the marketing widget and licensed companion from mounting
together.
