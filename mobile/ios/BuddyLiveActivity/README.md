# iOS Live Activity (ActivityKit)

`BuddyLiveActivity.swift` is part of the XcodeGen-created `BuddieWidgets`
extension. It shows the current locally synced mood on the Lock Screen and,
on supported iPhones, Dynamic Island.

The host app starts a Live Activity only after the user taps **Start Live
Activity**. Updates are local and use `Activity.update`; this project does not
request an ActivityKit push token and has no APNs update path. iOS decides when
the surface is visible and may end or dismiss it.

Generate the project from `mobile/ios` with `xcodegen generate`, then configure
the `group.com.buddieai.shadow` App Group for both signed targets in the Apple
Developer portal. A physical device is required for Secure Enclave sign-in and
meaningful Live Activity validation.
