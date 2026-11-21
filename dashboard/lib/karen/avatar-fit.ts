"use client";

/**
 * Auto-scale / frame GLB avatars + verify ARKit morphs for Sass-10 lipsync.
 */

import * as THREE from "three";

import { KAREN_ACTIVE_PROFILE, type KarenAvatarProfile } from "./avatar-assets";

/**
 * Force avatar to face the camera (radians around Y on armature / vrm.scene).
 * Tunable: 0 | Math.PI | Math.PI/2 | -Math.PI/2 — keep in sync with MODEL_YAW.
 */
export const KAREN_MODEL_FACING_YAW = KAREN_ACTIVE_PROFILE.facingYaw;

/** Target full-body height in meters. */
export const KAREN_TARGET_HEIGHT = 1.6;
/** Target bust/head-shoulders height — Tripo crops must not become giant heads. */
export const KAREN_BUST_TARGET_HEIGHT = 0.82;
export const KAREN_MIN_HEIGHT = 0.5;
export const KAREN_MAX_HEIGHT = 3.0;

/** Critical ARKit shapes for anger + jaw lipsync. */
export const KAREN_REQUIRED_BLENDSHAPES = [
  "jawOpen",
  "browDownLeft",
  "browDownRight",
  "mouthSmileLeft",
] as const;

export type KarenBlendshapeReport = {
  ok: boolean;
  found: string[];
  missing: string[];
  dictionaries: Array<{ mesh: string; keys: string[] }>;
};

export type KarenFitResult = {
  scale: number;
  height: number;
  eyeY: number;
  /** True when the GLB looks like a head/shoulder crop, not a full body. */
  isBust: boolean;
  center: THREE.Vector3;
  /** Present for rigged `figure` avatars: where the camera should look and from how far. */
  face?: KarenFaceFrame;
};

export type KarenFaceFrame = {
  eyeY: number;
  /** Y the camera aims at (slightly below the eyes). */
  aimY: number;
  /** Camera distance from the face (m). */
  dist: number;
  /** True when eyeY came from real eye bones rather than a body-height guess. */
  fromBones: boolean;
};

/**
 * Collect morphTargetDictionary keys from every mesh under `root`.
 */
export function collectMorphDictionaries(
  root: THREE.Object3D,
): Array<{ mesh: string; keys: string[] }> {
  const out: Array<{ mesh: string; keys: string[] }> = [];
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const dict = obj.morphTargetDictionary;
    if (!dict) return;
    out.push({
      mesh: obj.name || "(unnamed)",
      keys: Object.keys(dict),
    });
  });
  return out;
}

/**
 * Verify Sass-10 ARKit blendshapes. Logs CRITICAL if missing.
 */
export function verifyKarenBlendshapes(root: THREE.Object3D): KarenBlendshapeReport {
  const dictionaries = collectMorphDictionaries(root);
  const allKeys = new Set<string>();
  for (const d of dictionaries) {
    for (const k of d.keys) allKeys.add(k);
  }

  // Case-insensitive match (RPM sometimes varies casing).
  const lowerMap = new Map<string, string>();
  for (const k of allKeys) lowerMap.set(k.toLowerCase(), k);

  const found: string[] = [];
  const missing: string[] = [];
  for (const need of KAREN_REQUIRED_BLENDSHAPES) {
    const hit = lowerMap.get(need.toLowerCase());
    if (hit) found.push(hit);
    else missing.push(need);
  }

  const ok = missing.length === 0;
  const morphKeys = [...allKeys];
  // Diagnose for F12 — if jawOpen / mouthSmile / eyeBlink are missing, GLB can't lipsync.
  console.log("MORPH TARGETS:", morphKeys);
  if (ok) {
    console.info("[karen/avatar] Blendshapes verified. Karen is ready to be angry.");
  } else {
    console.warn(
      "%cWARNING: NO BLENDSHAPES DETECTED. LIP-SYNC WILL BE FAKE.",
      "color:#ff2d55;font-size:16px;font-weight:900;background:#1a0005;padding:6px 10px;",
    );
    console.error(
      "CRITICAL: GLB missing ARKit blendshapes — enabling shout head-bob fallback.",
      { missing, found, meshCount: dictionaries.length },
    );
  }

  return { ok, found, missing, dictionaries };
}

function measure(root: THREE.Object3D): {
  box: THREE.Box3;
  size: THREE.Vector3;
  center: THREE.Vector3;
  height: number;
} {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return {
    box,
    size,
    center,
    height: size.y > 0.0001 ? size.y : 1,
  };
}

/**
 * Head/shoulder crops are roughly as tall as they are wide.
 * Full bodies are typically >2× taller than wide.
 */
export function isKarenBustMesh(height: number, size: THREE.Vector3): boolean {
  const footprint = Math.max(size.x, size.z, 0.001);
  return height < 1.25 || height / footprint < 2.05;
}

/**
 * Uniformly scale + plant a loaded avatar.
 * 1) Massive (>3) → ×0.5; tiny (<0.5) → ×2
 * 2) Refine to bust (~0.82) or full-body (~1.6) target
 * 3) Center X/Z; shift Y so the base sits on the floor (y=0)
 */
export function fitKarenAvatarToStage(
  root: THREE.Object3D,
  profile: KarenAvatarProfile = KAREN_ACTIVE_PROFILE,
): KarenFitResult {
  // Reset so repeated fits don't compound, then face the camera (export-axis fix).
  root.position.set(0, 0, 0);
  root.rotation.set(0, profile.facingYaw, 0);
  root.scale.set(1, 1, 1);

  let { size, height } = measure(root);

  // Coarse correction from the brief.
  let scale = 1;
  if (height > KAREN_MAX_HEIGHT) {
    scale = 0.5;
  } else if (height < KAREN_MIN_HEIGHT) {
    scale = 2;
  }

  root.scale.set(scale, scale, scale);
  ({ size, height } = measure(root));

  // A rigged figure is never a "bust": its T-pose arm span would otherwise trip the
  // width heuristic and shrink the whole body to 0.82 m.
  const isFigure = profile.kind === "figure";
  const bust = isFigure ? false : isKarenBustMesh(height, size);
  const target = bust ? KAREN_BUST_TARGET_HEIGHT : KAREN_TARGET_HEIGHT;
  const refine = target / height;
  scale *= refine;
  root.scale.set(scale, scale, scale);

  const fitted = measure(root);

  // Center X/Z; plant base on the floor (pivot may have been mid-mesh).
  root.position.x -= fitted.center.x;
  root.position.z -= fitted.center.z;
  root.position.y -= fitted.box.min.y;
  root.updateMatrixWorld(true);

  const final = measure(root);
  // Eyes: mid-upper on busts, near top on full bodies.
  let eyeY = bust
    ? final.box.min.y + final.size.y * 0.62
    : final.box.min.y + final.size.y * 0.93;

  // Rigged figure: aim at the REAL eye bones instead of a guessed body fraction.
  let face: KarenFaceFrame | undefined;
  if (isFigure) {
    const boneEyeY = findEyeBoneY(root);
    if (boneEyeY !== null) eyeY = boneEyeY;
    const dist = (profile.faceCamDistance ?? 0.95) * (final.height / KAREN_TARGET_HEIGHT);
    face = {
      eyeY,
      aimY: eyeY - (profile.faceAimBelowEye ?? 0.04),
      dist,
      fromBones: boneEyeY !== null,
    };
  }

  console.info("[karen/avatar] fitKarenAvatarToStage", {
    scale: Number(scale.toFixed(4)),
    height: Number(final.height.toFixed(3)),
    eyeY: Number(eyeY.toFixed(3)),
    isBust: bust,
    kind: profile.kind,
    face: face
      ? { aimY: Number(face.aimY.toFixed(3)), dist: Number(face.dist.toFixed(3)), fromBones: face.fromBones }
      : undefined,
  });

  return {
    scale,
    height: final.height,
    eyeY,
    isBust: bust,
    center: new THREE.Vector3(0, eyeY, 0),
    face,
  };
}

/**
 * Speech-shaped mouth energy (0–0.85) for when she is "speaking" but there is no audio
 * buffer to analyse (browser speechSynthesis can't be tapped). ~4.6 syllables/s, breathing
 * word-group phrasing, slight jitter — deliberately an APPROXIMATION, not audio-synced.
 */
export function karenProceduralMouthEnergy(tMs: number): number {
  const syllable = Math.abs(Math.sin((tMs / 1000) * Math.PI * 2 * 2.3));
  const phrase = 0.55 + 0.45 * Math.sin((tMs / 1000) * Math.PI * 2 * 0.7);
  const jitter = 0.9 + 0.1 * Math.sin(tMs * 0.013);
  return Math.min(0.85, syllable * (0.3 + 0.55 * phrase) * jitter);
}

/**
 * Swing the upper arms down out of a T-pose. Idempotent: the rest rotation is remembered on
 * the bone, so calling this repeatedly (re-fit, HMR) never compounds. Returns bones moved.
 */
export function relaxKarenFigureArms(root: THREE.Object3D, radians: number): number {
  let moved = 0;
  root.traverse((obj) => {
    if (!/^(left|right)_?arm$/i.test(obj.name)) return;
    const rest =
      typeof obj.userData.__karenRestRotX === "number"
        ? (obj.userData.__karenRestRotX as number)
        : obj.rotation.x;
    obj.userData.__karenRestRotX = rest;
    obj.rotation.x = rest + radians;
    moved++;
  });
  root.updateMatrixWorld(true);
  return moved;
}

/**
 * World-space Y of the eyes, from `LeftEye` / `RightEye` bones (Avaturn / RPM).
 * Fallback: `Head` bone (v4 Avaturn exports omit eye bones) — nudge slightly down
 * toward the eye line so the face stays framed, not the top of the skull.
 */
export function findEyeBoneY(root: THREE.Object3D): number | null {
  root.updateMatrixWorld(true);
  const ys: number[] = [];
  const p = new THREE.Vector3();
  root.traverse((obj) => {
    if (/^(left|right)_?eye$/i.test(obj.name)) {
      obj.getWorldPosition(p);
      ys.push(p.y);
    }
  });
  if (ys.length) {
    return ys.reduce((a, b) => a + b, 0) / ys.length;
  }
  let headBone: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (headBone) return;
    if (/^head$/i.test(obj.name)) headBone = obj;
  });
  if (!headBone) return null;
  (headBone as THREE.Object3D).getWorldPosition(p);
  return p.y - 0.045;
}

/**
 * FaceTime framing — camera on the eye line.
 * Defaults: FOV 25, z 2.0, lookAt(eyes at ~1.6).
 */
export function frameKarenCameraToEyes(
  camera: THREE.PerspectiveCamera,
  eyeY: number,
  opts: {
    z?: number;
    fov?: number;
    near?: number;
    far?: number;
    camY?: number;
    aimY?: number;
    target?: THREE.Vector3;
  } = {},
): void {
  const z = opts.z ?? 2.0;
  const fov = opts.fov ?? 25;
  const near = opts.near ?? 0.1;
  const far = opts.far ?? 100;
  const aimY = opts.aimY ?? eyeY;
  const camY = opts.camY ?? eyeY;
  camera.fov = fov;
  camera.near = near;
  camera.far = far;
  camera.position.set(0, camY, z);
  camera.lookAt(0, aimY, 0);
  camera.updateProjectionMatrix();
  if (opts.target) {
    opts.target.set(0, aimY, 0);
  }
}

/**
 * ReadyPlayerMe / TalkingHead lip morph aliases.
 * When RPM GLB lands, jawOpen + viseme_aa (and friends) drive real lips.
 */
export const KAREN_LIP_MORPH_ALIASES: Record<string, string[]> = {
  jawOpen: ["jawOpen", "JawOpen", "jaw_open", "mouthOpen", "MouthOpen"],
  viseme_aa: [
    "viseme_aa",
    "viseme_AA",
    "viseme_a",
    "mouthOpen",
    "JawOpen",
    "jawOpen",
  ],
  viseme_E: ["viseme_E", "viseme_e", "mouthSmile"],
  viseme_I: ["viseme_I", "viseme_i"],
  viseme_O: ["viseme_O", "viseme_o", "mouthFunnel"],
  viseme_U: ["viseme_U", "viseme_u", "mouthPucker"],
};

/**
 * Apply morph weight if the shape exists (case-insensitive).
 */
export function setMorphWeight(
  root: THREE.Object3D,
  name: string,
  value: number,
): boolean {
  let applied = false;
  const want = name.toLowerCase();
  const aliases = (KAREN_LIP_MORPH_ALIASES[name] || [name]).map((a) =>
    a.toLowerCase(),
  );
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const dict = obj.morphTargetDictionary;
    const infl = obj.morphTargetInfluences;
    if (!dict || !infl) return;
    for (const [key, idx] of Object.entries(dict)) {
      const lower = key.toLowerCase();
      if (
        (lower === want || aliases.includes(lower)) &&
        typeof idx === "number"
      ) {
        infl[idx] = THREE.MathUtils.clamp(value, 0, 1);
        applied = true;
      }
    }
  });
  return applied;
}

/**
 * After loadGLTF / showAvatar — ensure jawOpen + viseme_aa are reachable.
 * Returns which canonical lip morphs were found on the mesh.
 */
export function mapKarenLipMorphTargets(root: THREE.Object3D): {
  jawOpen: boolean;
  viseme_aa: boolean;
  keys: string[];
} {
  const dictionaries = collectMorphDictionaries(root);
  const allKeys = dictionaries.flatMap((d) => d.keys);
  const lower = new Set(allKeys.map((k) => k.toLowerCase()));

  const hasAny = (names: string[]) =>
    names.some((n) => lower.has(n.toLowerCase()));

  const jawOpen = hasAny(KAREN_LIP_MORPH_ALIASES.jawOpen!);
  const viseme_aa = hasAny(KAREN_LIP_MORPH_ALIASES.viseme_aa!);

  console.info("[karen/avatar] lip morph map", {
    jawOpen,
    viseme_aa,
    morphCount: allKeys.length,
  });

  // Smoke-set / clear so TalkingHead + RPM share the same channel.
  if (jawOpen) setMorphWeight(root, "jawOpen", 0);
  if (viseme_aa) setMorphWeight(root, "viseme_aa", 0);

  return { jawOpen, viseme_aa, keys: allKeys };
}
