# Buddie Android Companion

Native Kotlin companion for API 26–36. Stage 2A adds secure web-account handoff,
server-authoritative entitlement checks, a user-enabled native overlay, and a
visible foreground service. It does not contain Oracle logic or a floating
WebView.

## User flow

1. **Sign in securely** opens `https://www.buddieai.com/mobile/connect` in the
   system browser with a PKCE challenge, random state, and the install's public
   P-256 key.
2. Existing NextAuth completes normal web sign-in. No browser cookie or
   password is returned to Android.
3. The browser returns a two-minute encrypted authorization code in the
   `buddieai://auth` fragment. The code is bound to PKCE, state, and the Android
   Keystore public key, persisted server-side, and atomically consumed once.
4. Android proves possession of the non-exportable private key and exchanges
   the code for a 14-day device-bound refresh credential. Only its SHA-256 hash
   is stored server-side.
5. Exchange and refresh responses call the canonical entitlement and companion
   services. Android never computes paid access locally. Each successful
   refresh atomically invalidates the previous credential; reuse revokes that
   refresh family and device.
6. An entitled user enables the companion, grants notification and
   `SYSTEM_ALERT_WINDOW` permission, and starts the foreground service.

The refresh credential is AES-GCM encrypted under an Android Keystore key and
stored in `noBackupFilesDir`. Logout stops the service, removes the overlay,
requests server-side device revocation, deletes encrypted values, and destroys
both Keystore keys. Local cleanup is unconditional if the network is
unavailable; the destroyed device key makes the retained server credential
unusable, and its normal expiry still applies.

PostgreSQL stores the minimum durable lifecycle state: device public-key
bindings, one-time handoff consumption, hashed refresh-token families, and
consumed proof nonces. It stores no raw refresh credential or invasive device
identifier. Password changes/account deletion preserve global invalidation,
while one device can be revoked without affecting another.

## Companion architecture

- `CompanionStateMachine` owns `OFF`, `PERMISSION_REQUIRED`, `STARTING`,
  `ACTIVE`, `PAUSED`, `OFFLINE`, `ENTITLEMENT_REQUIRED`, and `ERROR`.
- `CompanionService` is an unexported `specialUse` foreground service. It
  displays a persistent notification and revalidates entitlement every 15
  minutes, not continuously.
- `OverlayController` owns one `TYPE_APPLICATION_OVERLAY` `WindowManager`
  window.
- `FloatingOrbView` is native, draggable, accessible, remembers position, opens
  the allowlisted Oracle deep link, and has an immediate disable control.
- The service uses `START_NOT_STICKY`. Stage 2A does not start at boot and does
  not attempt hidden or OS-bypass recovery.
- Presence reuses the existing presence service: successful entitled
  exchange/refresh updates its check-in. The current server model has no
  explicit active/off field, so disabling does not invent one.

If permission is revoked, the app removes/stops the overlay and enters
`PERMISSION_REQUIRED`. If entitlement is revoked, the service removes the orb
and enters `ENTITLEMENT_REQUIRED`. Network loss while already active keeps the
orb available and displays `OFFLINE` for at most 24 hours from the last
successful entitlement confirmation. After that explicit grace period the orb
stops until the app can revalidate access. A fresh unverified start fails
closed.

## Permissions and Play policy

- `INTERNET`: HTTPS authentication and entitlement checks.
- `POST_NOTIFICATIONS`: visible foreground-service status on Android 13+.
- `SYSTEM_ALERT_WINDOW`: user-approved orb over other apps.
- `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_SPECIAL_USE`: visible,
  user-controlled companion lifecycle.

The manifest includes the `specialUse` subtype explanation. Google Play may
reject the use case or require a declaration/demo. Product/legal review is
required before store submission. Stage 2A does not implement an Android
upgrade/checkout flow.

Persistent/best-effort companion availability is subject to Android and device
restrictions. Android 15 is API 35; this app targets Android 16/API 36. Android
and OEM battery managers may terminate the
service. Overlay permission does not guarantee indefinite survival.

## Toolchain and dependencies

- JDK 17; Android SDK/Build Tools 36; Gradle 8.13
- Android Gradle Plugin 8.13.0; Kotlin 2.4.10
- Runtime implementation uses Android platform APIs only.
- JUnit 4.13.2 and Kotlin test are test-only (EPL 1.0 / Apache 2.0).
- AndroidX Test Core/Runner 1.7.0 and Ext JUnit 1.3.0 are test-only,
  Apache 2.0 dependencies required to execute Keystore, service, and overlay
  instrumentation tests. They add no release runtime code.

## Build and test

```powershell
.\gradlew.bat testDebugUnitTest
.\gradlew.bat assembleDebug
.\gradlew.bat assembleRelease
.\gradlew.bat assembleDebugAndroidTest
.\gradlew.bat lintDebug
```

Run instrumentation tests on an emulator/device:

```powershell
.\gradlew.bat connectedDebugAndroidTest
```

The backend bridge must be deployed before end-to-end sign-in can succeed.
Apply the reviewed additive mobile-auth SQL before deploying backend code that
uses it. This repository has no Prisma migration baseline; do not run
`prisma migrate deploy` or `prisma db push` against production for this change.

Release signing material remains external and gitignored. A production build
may read `BUDDIE_ANDROID_KEYSTORE_PATH`,
`BUDDIE_ANDROID_KEYSTORE_PASSWORD`, `BUDDIE_ANDROID_KEY_ALIAS`, and
`BUDDIE_ANDROID_KEY_PASSWORD`; never commit their values or a keystore.

## Physical-device acceptance checklist

Record device model, Android build, battery mode, and results for each:

1. Fresh install and web sign-in returns `Authenticated`.
2. Paid/unpaid server responses produce available/`ENTITLEMENT_REQUIRED`.
3. Permission denial remains `PERMISSION_REQUIRED`; grant reaches `ACTIVE`.
4. Orb remains on Home and over another app.
5. Drag persists position; tap opens Oracle; close removes orb.
6. Disable removes overlay and foreground notification.
7. Overlay revocation removes the orb.
8. Logout removes orb and destroys local credentials.
9. Network loss enters `OFFLINE` without a crash; restore revalidates.
10. Screen lock/unlock and process termination behavior are recorded.
11. Reboot behavior is recorded; expected Stage 2A behavior is **no automatic
    restart**.
12. Subscription revocation removes access at the next server check.

Test Pixel/reference Android, Samsung, and Xiaomi/Redmi where hardware is
available. Do not add OEM-specific battery or autostart hacks.

## Deep links and security

User destinations remain strictly allowlisted:

- `buddieai://open`
- `buddieai://oracle`
- `buddieai://settings`
- `buddieai://companion`

`buddieai://auth` is handled only by the authentication repository and is never
forwarded as a web destination. The two-minute authorization code is put in a
URI fragment; bearer/refresh credentials are never placed in deep links.
No token, cookie, authorization header, password, key, or license is logged.
Cleartext network traffic is disabled in the manifest.
