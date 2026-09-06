# Buddie iOS companion

This directory contains a source-complete SwiftUI companion app, WidgetKit
Home/Lock Screen widgets, and an ActivityKit Live Activity/Dynamic Island
extension. The checked-in `project.yml` is the source of truth; generated
`.xcodeproj` files should not be committed.

## Generate and build

On macOS with Xcode 15 or newer:

```sh
brew install xcodegen
cd mobile/ios
xcodegen generate
open Buddie.xcodeproj
```

In Xcode, select an Apple Developer team and enable the
`group.com.buddieai.shadow` App Group for both `Buddie` and `BuddieWidgets`.
The identifiers are:

- App: `com.buddieai.shadow`
- Widget/Live Activity extension: `com.buddieai.shadow.widgets`
- Tests: `com.buddieai.shadow.tests`

Replace the empty App Icon slot in `Resources/Assets.xcassets` before archive.
No development team, provisioning profile, signing material, API secret, or
production credential is stored here.

## Authentication and data

Sign-in uses `ASWebAuthenticationSession` at
`https://www.buddieai.com/mobile/connect`. The app creates PKCE/state values and
a non-exportable Secure Enclave P-256 key. It wraps the public X9.63 point in
P-256 SPKI DER for the backend, and signs the exact
`buddie-mobile-proof-v1` exchange/refresh/logout message. Rotating refresh
credentials are stored as ThisDeviceOnly Keychain data; browser cookies and
credentials are never copied into the app.

The server remains authoritative for entitlement. Offline mode displays only
the last App Group snapshot and labels it as stale; it never grants access.
Only allowlisted `buddieai://` destinations are routed.

## Platform limits

- Secure Enclave authentication and signing require a signed physical device;
  the iOS Simulator cannot create this non-exportable key.
- Live Activities are started by an explicit in-app button, updated locally,
  and ended by the user or system. There is no APNs backend or fabricated
  remote-update path.
- iOS controls Live Activity duration/visibility. Dynamic Island is shown only
  on supported hardware. iOS does not permit an arbitrary overlay over other
  apps.
- Universal Links are intentionally not enabled pending an associated-domains
  deployment and finalized signing setup.

Run the pure encoding, deep-link, callback, and snapshot tests from the
`Buddie` scheme. Final compilation, signing, widget previews, Live Activity,
notification, and device login validation require macOS, Xcode, an Apple
Developer account, and physical iPhone testing.
