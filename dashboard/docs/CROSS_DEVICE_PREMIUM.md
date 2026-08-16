# Cross-device premium experience

**Product rule:** Buddie is one companion. Devices may use different *technical* paths. The user must never see which path.

```
USER → BUDDIE CHARACTER + MEMORY → CAPABILITY DETECTOR → SMART ROUTER
  → Soul Engine (always) → optional local enricher → PERSONALITY → ORB
```

## Non-negotiable (never show)

- WebGPU / Safari / iPhone “unsupported”
- Download 2GB model / Configure API / API key required
- Provider / model unavailable
- Any intelligence-path label (`composed_local`, `full_local`, …)

## Architecture guarantees

| Guarantee | Implementation |
|-----------|----------------|
| Immediate first interaction | `getAdaptiveRuntime().ready === true` before optional warm-up |
| No mandatory model download | Optional enricher is idle-only, local, never gating |
| Orb never blank | CSS orb paints first; WebGL enhances when ready |
| Soul Engine always answers | Cost router → `runSoulEngine`; soft character fallback on throw |
| Same personality across devices | Server `User.personality` seeds talk + local vibe |

## Compatibility matrix (policy + automated)

| Surface | Orb | Intelligence | Status |
|---------|-----|--------------|--------|
| iPhone Safari | CSS | Soul Engine (`composed_local`) | **Code PASS** / physical QA **required** |
| iPhone installed PWA | CSS | Soul Engine | **Code PASS** / physical QA **required** |
| Android Chrome | CSS | Soul Engine | **Code PASS** / physical QA **required** |
| Android installed PWA | CSS | Soul Engine | **Code PASS** / physical QA **required** |
| Desktop Chrome | CSS → WebGL enhance | Soul + optional enricher when practical | **Code PASS** / field QA recommended |
| Desktop Edge | CSS → WebGL enhance | Soul + optional enricher | **Code PASS** / field QA recommended |
| Desktop Safari | CSS | Soul Engine | **Code PASS** / field QA recommended |
| Firefox | CSS (WebGL if capable) | Soul Engine | **Code PASS** / field QA recommended |

Automated suite: `src/intelligence/cross-device-premium.test.ts` (+ invisible-adaptation, device-capabilities, mobile-perf).

## Physical QA gate (blocking for “production-ready”)

Do **not** call the product production-ready for mobile until these pass on **real devices**:

1. **iPhone Safari** — login → onboarding → dashboard orb visible immediately → talk reply → refresh persistence → logout  
2. **Android Chrome** — same flow + Add to Home Screen / PWA open  
3. **Desktop Chrome** — same flow + billing return URL if testing paid  

Also verify: private/incognito soft storage, airplane-mode soft presence, no plumbing text in replies.

## What we do *not* claim

- This document + CI tests prove **routing policy** and **copy hygiene**.  
- They do **not** replace physical-device verification of touch, PWA install, Safari ITP, or GPU drivers.
