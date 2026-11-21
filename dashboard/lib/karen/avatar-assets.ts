/**
 * Single source of truth for Karen's avatar asset URLs.
 *
 * Every model keeps its own immutable filename under `public/models/`, so
 * switching avatars can never be served stale by the HTTP cache or the PWA
 * service worker. To switch: change KAREN_ACTIVE_AVATAR below. Nothing else.
 */
export const KAREN_AVATAR_FILES = {
  /** Original Tripo PBR meshopt bust. */
  v1: "tripo_pbr_model_6c9e0995-d62d-4bdc-884e-a6de4774ef66_meshopt-v1.glb",
  /** Second Tripo PBR meshopt bust. */
  v2: "tripo_pbr_model_7bf2604c-06c4-4912-abe4-3dce936fda72_meshopt-v2.glb",
  /**
   * Avaturn full-body avatar — skeleton + 72 ARKit/Oculus-viseme morph targets on
   * Head_Mesh (jawOpen, viseme_aa…), so lip-sync moves a REAL mouth.
   */
  v3: "avaturn_model-v3.glb",
  /**
   * Avaturn full-body (Downloads `model (4).glb`) — Mixamo-style rig, no facial morphs.
   * Audio still drives Head/chest motion; swap back to v3 for true jawOpen lips.
   */
  v4: "avaturn_model-v4.glb",
  /**
   * Avaturn full-body (Downloads `model (5).glb`) — 72 ARKit morphs on Head_Mesh
   * (jawOpen + visemes). Active stage avatar; shirt tinted blood-red in code.
   */
  v5: "avaturn_model-v5.glb",
} as const;

export type KarenAvatarId = keyof typeof KAREN_AVATAR_FILES;

/**
 * How each export must be presented. Models are authored with different forward
 * axes and proportions, so facing + framing is per-avatar instead of one global.
 *  - bust:   static head/shoulder crop — auto-detected, camera frames the bbox.
 *  - figure: rigged full body — camera is aimed at the eye bones, head & shoulders.
 */
export type KarenAvatarProfile = {
  /** Radians about Y that turn the export toward the camera. glTF-standard = 0. */
  facingYaw: number;
  kind: "bust" | "figure";
  /** figure only — camera distance (m) from the face, for a ~1.6 m tall figure. */
  faceCamDistance?: number;
  /** figure only — aim this many metres BELOW the eye line (keeps chin + neck in frame). */
  faceAimBelowEye?: number;
  /** figure only — radians to swing the upper arms down from a T-pose (local X of Left/RightArm). */
  armDrop?: number;
  /**
   * figure only — GAMEPLAY layout. The answer dock covers the lower ~55% of the screen, so
   * while a question is live the head is pulled back (distance × scale) and raised (aim this
   * many metres below the eyes) to sit in the clear band under the rage-meter header — the
   * mouth stays visible while she talks.
   */
  gameCamDistanceScale?: number;
  gameAimBelowEye?: number;
};

export const KAREN_AVATAR_PROFILES: Record<KarenAvatarId, KarenAvatarProfile> = {
  v1: { facingYaw: -Math.PI / 2, kind: "bust" },
  v2: { facingYaw: -Math.PI / 2, kind: "bust" },
  // 1.3 m keeps the whole head (hair → chin) inside the clear band between the rage-meter
  // header and the answer dock; 0.95 filled the screen and hid the chin behind the dock.
  // armDrop 1.25 rad: Avaturn exports in T-pose; measured on the rig, +X on both arm bones lowers them.
  v3: {
    // Avaturn glTF ships camera-backwards — 180° turns her face to the lens.
    facingYaw: Math.PI,
    kind: "figure",
    faceCamDistance: 1.3,
    faceAimBelowEye: 0.04,
    armDrop: 1.25,
    gameCamDistanceScale: 1.25,
    gameAimBelowEye: 0.24,
  },
  // Same figure framing as v3; Head bone substitutes for missing LeftEye/RightEye.
  // Math.PI — Avaturn `model (4)` ships camera-backwards in glTF; 180° faces the lens.
  v4: {
    facingYaw: Math.PI,
    kind: "figure",
    faceCamDistance: 1.35,
    faceAimBelowEye: 0.06,
    armDrop: 1.25,
    gameCamDistanceScale: 1.28,
    gameAimBelowEye: 0.26,
  },
  // `model (5).glb` — same Avaturn figure contract as v3 (morphs + Mixamo arms).
  v5: {
    facingYaw: Math.PI,
    kind: "figure",
    faceCamDistance: 1.3,
    faceAimBelowEye: 0.04,
    armDrop: 1.25,
    gameCamDistanceScale: 1.25,
    gameAimBelowEye: 0.24,
  },
};

/**
 * The avatar the app renders.
 * Prefer morph-capable exports (v3 / v5). v4 has 0 jawOpen/viseme targets.
 */
export const KAREN_ACTIVE_AVATAR: KarenAvatarId = "v5";

export const KAREN_ACTIVE_PROFILE: KarenAvatarProfile = KAREN_AVATAR_PROFILES[KAREN_ACTIVE_AVATAR];

/** Tripo PBR meshopt bust (fallback when karen.vrm is missing). */
export const KAREN_GLB_URL = `/models/${KAREN_AVATAR_FILES[KAREN_ACTIVE_AVATAR]}`;
