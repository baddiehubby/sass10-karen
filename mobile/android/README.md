# Android Shadow Companion (TWA + App Widget)

Wrap the Buddie AI PWA with [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) or [PWABuilder](https://www.pwabuilder.com/).

## Quick start

1. Point TWA manifest at `https://www.buddieai.com/pwa`.
2. Enable Digital Asset Links for `www.buddieai.com`.
3. Add an App Widget that reads mood color from `/api/presence/state?licenseKey=…` (stored in encrypted prefs after dashboard login).

## Widget behavior

- Small 2×2 home screen tile: orb gradient tinted by `MOOD_BADGE_COLORS` from presence API.
- Tap opens the full PWA (`/pwa`).

See `twa-manifest.template.json` for Bubblewrap fields.
