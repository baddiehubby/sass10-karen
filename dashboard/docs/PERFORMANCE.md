# BuddieAI — Mobile Performance & UX

**Target:** iPhone Safari is a first-class product surface. Android Chrome, Desktop Chrome, Desktop Edge, and Desktop Safari share the same core path.

**Date measured:** 2026-08-16  
**Environment:** production `next build` + `next start` on localhost (Lighthouse 12.2.1, headless Chromium)

---

## Principles

| Rule | Implementation |
|------|----------------|
| WebGPU is never required | Used only as an optional gate for a tiny enricher; Soul Engine is always sync/local |
| WebGL is never required | Marketing/login orb defaults to CSS `BuddyOrb` on mobile / WebKit / low-power / reduced-motion |
| No mandatory model download | Optional tiny enricher is dynamic-imported and idle-warmed only |
| Intelligence never blocks UX | `IntelligenceWarmup` uses `requestIdleCallback` (timeout 2.5s); login/onboarding/orb/dashboard stay interactive |
| Persistence may fail | `lib/client-storage.ts` falls back to in-memory session mode — no technical error toasts |
| Prefer CSS/canvas over heavy rAF | Dashboard orb is CSS; pointer tilt is rAF-throttled; WebGL path uses lower detail + `powerPreference: "low-power"` |

---

## Matrix (product expectations)

| Surface | iPhone Safari | Android Chrome | Desktop Chrome / Edge | Desktop Safari |
|---------|---------------|----------------|-----------------------|----------------|
| Login | CSS orb | CSS orb (mobile UA / coarse pointer) | WebGL enhancement when capable | CSS orb (WebKit) |
| Landing | CSS orb on phone | CSS orb on phone | WebGL when capable | CSS orb |
| Dashboard / onboarding | CSS `BuddyOrb` | CSS `BuddyOrb` | CSS `BuddyOrb` | CSS `BuddyOrb` |
| Soul replies | Instant local | Instant local | Instant local | Instant local |
| Offline / private mode | In-memory session | In-memory session | In-memory session | In-memory session |

---

## Architecture notes

### Orb

- `components/cinematic-orb.tsx` — public entry; starts on CSS, lazy-loads WebGL only when `resolveOrbRenderMode()` returns `webgl`
- `components/cinematic-orb-webgl.tsx` — Three.js / R3F (code-split, `ssr: false`)
- `lib/orb-render-policy.ts` — CSS preferred for WebKit, mobile UA, coarse pointer, ≤900px, reduced-motion, low-power, missing WebGL
- `components/buddy-orb.tsx` — production companion orb (CSS); pauses when `document.hidden`; honors reduced motion

### Storage

- `lib/client-storage.ts` — probe + memory fallback
- Mood, identity, presence license key, theme, consent mirrors use safe helpers
- No IndexedDB hard dependency for core companion interaction

### Service worker

- `@ducanh2912/next-pwa` with `cacheOnFrontEndNav: false` and `aggressiveFrontEndNavCaching: false` to reduce stale shells on Safari
- Shadow companion script remains imported for offline mood queue / push hooks
- `reloadOnOnline: true` restores network after offline

### Fonts

- `next/font` with `display: "swap"` (Inter / JetBrains Mono root; Fraunces / Outfit on dashboard)
- Mono preload disabled to shrink critical path

### Intelligence

- `scheduleIdleWarmup()` never blocks first paint or first reply
- Mounted on `/dashboard` and `/onboarding` only as invisible idle work

### Motion / battery / Safari lifecycle

- `prefers-reduced-motion` short-circuits landing motion loops and confetti
- HolyMusic analyser rAF pauses on `visibilitychange` / `pagehide`
- Orb tilt updates coalesced to one rAF per frame

---

## Lighthouse results (lab)

> Lab Chromium ≠ real iPhone Safari. Mobile form-factor still uses Chromium; CSS-orb policy is applied via mobile UA / viewport heuristics. Field QA on a physical iPhone remains required.

### Mobile (Lighthouse mobile emulation)

| Page | Perf score | FCP | LCP | TBT | CLS | Speed Index |
|------|------------|-----|-----|-----|-----|-------------|
| `/` (home) | **95** | 1.1 s | 2.9 s | 80 ms | 0 | — |
| `/login` | **70** | 1.1 s | 3.7 s | 830 ms | 0 | — |

### Desktop

| Page | Perf score | FCP | LCP | TBT | CLS |
|------|------------|-----|-----|-----|-----|
| `/` (home) | **87** | 0.3 s | 1.0 s | 90 ms | 0.226 |

### Next.js build (First Load JS)

- Shared by all routes: **~167 kB** (framework + shared chunks)
- WebGL orb ships in a separate async chunk (not on the CSS-first mobile path)

---

## Known follow-ups

1. Login TBT remains higher than home (auth client + shared app chrome). Further split of NextAuth client surface if scores regress.
2. Desktop home CLS (~0.23) — tighten immersive layout reservation for whisper/CTA.
3. Physical device pass: iPhone Safari (iOS 17+), Android Chrome, Desktop Edge/Safari — orb smoothness, private browsing, airplane mode.
4. Avoid precaching large binary downloads in the service worker if Workbox manifests grow.

---

## How to re-measure

```bash
cd dashboard
npm run build
npx next start -p 3457
npx lighthouse http://127.0.0.1:3457/ --only-categories=performance --form-factor=mobile --view
npx lighthouse http://127.0.0.1:3457/login --only-categories=performance --form-factor=mobile --view
```

Manual checklist:

- [ ] iPhone Safari: login → onboarding → dashboard orb tap (no blank WebGL screen)
- [ ] Low Power Mode + Reduce Motion: orb still present, animation still/soft
- [ ] Private tab: mood / orb still interact; no storage error UI
- [ ] Airplane mode after first load: shell remains usable; replies stay local
- [ ] Android Chrome + Desktop Edge: same flows
