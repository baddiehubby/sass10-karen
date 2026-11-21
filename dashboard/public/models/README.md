# Karen avatar

## Active model

Set in `lib/karen/avatar-assets.ts` → `KAREN_ACTIVE_AVATAR`.

| Id | File | Notes |
|----|------|--------|
| **v3** (active) | `avaturn_model-v3.glb` | Avaturn with `Head_Mesh` jawOpen + visemes — **real lip-sync**. |
| v4 | `avaturn_model-v4.glb` | From Downloads `model (4).glb`. **No ARKit morphs** — mouth cannot open. Do not activate for production fights. |
| v1 / v2 | Tripo meshopt busts | Legacy busts. |

## Lip-sync

- **With morphs (v3):** `jawOpen` / `viseme_*` driven by live AnalyserNode amplitude via `speakAudio` / `playWavWithLipsync`.
- **Without morphs (v4):** same audio pipeline → Head bone nod + chest pulse (`shout-fallback.ts`). The painted mouth cannot open without blendshapes.

To get real mouth movement on a new Avaturn export: enable facial blendshapes / ARKit in Avaturn, then drop the GLB here as a new `vN` and point `KAREN_ACTIVE_AVATAR` at it.

## Placement

`fitKarenAvatarToStage` + per-avatar `KAREN_AVATAR_PROFILES` (facing yaw, face cam distance, arm drop, game framing). Eye aim uses `LeftEye`/`RightEye`, or falls back to the `Head` bone (v4).
