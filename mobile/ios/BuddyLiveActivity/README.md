# iOS Live Activity (ActivityKit)

Live Activities show Buddy's current mood on the Lock Screen and Dynamic Island (iOS 16.1+).

## Architecture

1. Native SwiftUI extension (`BuddyLiveActivity`) receives mood updates via push or App Group shared defaults.
2. PWA / extension POST mood to `/api/presence/state`.
3. Server sends silent push with `content-state` payload when mood shifts significantly (e.g. concerned → happy).

## Setup (Xcode)

1. Create a new **Widget Extension** target with Live Activity support.
2. Add App Group `group.com.buddieai.shadow` to the main app and extension.
3. Write `currentMood` from the widget extension when the PWA updates shared `UserDefaults`.

See `BuddyLiveActivity.swift` for a minimal ActivityKit attribute stub.
