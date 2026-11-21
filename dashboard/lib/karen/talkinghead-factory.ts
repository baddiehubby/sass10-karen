"use client";

/**
 * Production TalkingHead factory for Karen SaaS.
 * Loads the vendored `@met4citizen/talkinghead` (Desktop/GLB/TalkingHead-main).
 *
 * Cinematic interrogation look: hard key + blood-red rim, ACES @ 0.8,
 * low-angle camera. No AmbientLight / soft hemi (they wash PBR faces ghost-white).
 *
 * Perf note: TalkingHead sets
 *   renderer.setPixelRatio(opt.modelPixelRatio * window.devicePixelRatio)
 * so we pass a *pre-divided* modelPixelRatio and re-clamp after construct.
 */

import type { TalkingHead, TalkingHeadOptions } from "@met4citizen/talkinghead";
import {
  applyExpressionToTalkingHead,
  lockAggressiveBrows,
  mapChatMoodToTalkingHead,
} from "@/lib/karen/expression-bridge";
import { KAREN_MODEL_FACING_YAW } from "@/lib/karen/avatar-fit";
import type {
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { KAREN_GLB_URL } from "./avatar-assets";
import { dispatchKarenSpeaking } from "./talkinghead-bus";

export { KAREN_MODEL_FACING_YAW };

/** Legacy Tripo meshopt PBR bust (fallback when VRM missing). */
export { KAREN_GLB_URL };
/** Preferred TalkingHead / VRoid asset. */
export const KAREN_VRM_URL = "/models/karen.vrm";
/** Original Tripo filename kept as an alias copy under /public/models/. */
export const KAREN_TRIPO_GLB_URL =
  "/models/tripo_pbr_model_6c9e0995-d62d-4bdc-884e-a6de4774ef66_meshopt-v1.glb";
export const TALKINGHEAD_WORKLET_URL = "/talkinghead/playback-worklet.js";
/**
 * Prefer TalkingHead (VRM/GLB). Set true only to force the static Tripo mesh path.
 */
export const KAREN_USES_TRIPO_MESH = false;
/**
 * Debug Y-axis facing for this VRM/GLB export.
 * Cycle with cycleKarenModelYaw() / window.__cycleKarenYaw() in the console:
 *   0 → Math.PI → Math.PI/2 → -Math.PI/2 → …
 * Math.PI left her in profile; current default is π/2.
 */
export const MODEL_YAW_CANDIDATES = [0, Math.PI, Math.PI / 2, -Math.PI / 2] as const;
/** Live browser test: −π/2 faces the Tripo GLB at the camera (π and π/2 were profile). */
export let MODEL_YAW: number = KAREN_MODEL_FACING_YAW;
/** @deprecated use MODEL_YAW — kept so older imports keep working. */
export const KAREN_VRM_FACING_YAW = MODEL_YAW;

/** Apply one of the four test yaws to armature / vrm.scene / Tripo model. */
export function applyKarenModelYaw(
  head: TalkingHead | null | undefined,
  yaw: number = MODEL_YAW,
): void {
  MODEL_YAW = yaw;
  applyKarenFacingCorrection(head, yaw);
  const host = head as HeadWithArmature & {
    __karenModel?: { rotation?: { y: number } } | null;
  };
  if (host?.__karenModel?.rotation) {
    host.__karenModel.rotation.y = yaw;
  }
}

/** Cycle 0 → π → π/2 → −π/2. Returns the yaw that was applied. */
export function cycleKarenModelYaw(
  head: TalkingHead | null | undefined,
): number {
  const cur = MODEL_YAW;
  const idx = MODEL_YAW_CANDIDATES.findIndex(
    (y) => Math.abs(y - cur) < 1e-9,
  );
  const next =
    MODEL_YAW_CANDIDATES[(idx < 0 ? 0 : idx + 1) % MODEL_YAW_CANDIDATES.length]!;
  applyKarenModelYaw(head, next);
  console.info(
    "[talkinghead-factory] cycled MODEL_YAW →",
    next,
    `(${(["0", "π", "π/2", "−π/2"] as const)[MODEL_YAW_CANDIDATES.indexOf(next)]})`,
  );
  return next;
}

/** Cap backing-store resolution — sharp on Retina, safe on mobile. */
export const KAREN_MAX_PIXEL_RATIO = 1.5;

/** Portrait lens — ReadyPlayerMe ~1.7m headshot. */
export const KAREN_CAMERA_FOV = 35;
export const KAREN_CAMERA_NEAR = 0.1;
export const KAREN_CAMERA_FAR = 100;
/** ACES exposure — 0.8 crushes the ghost-white face. */
export const KAREN_TONE_EXPOSURE = 0.8;
/** Soft key — 0.5 sculpts without blowing out albedo. */
export const KAREN_KEY_INTENSITY = 0.5;
/**
 * Soft hemisphere / ambient fill — OFF (ghost wash).
 * Kept as a constant so HMR / mood code can keep hemi.intensity = 0.
 */
export const KAREN_HEMI_INTENSITY = 0;
/** Optional AmbientLight cap if TalkingHead re-adds one — never above this. */
export const KAREN_AMBIENT_MAX = 0.2;
/** Red rim behind the head — hair/shoulder silhouette glow. */
export const KAREN_RIM_INTENSITY = 2.0;
/** Rim world position — behind the shoulders. */
export const KAREN_RIM_POSITION = { x: 0, y: 2, z: -3 } as const;
/** Key world position — top-left of camera. */
export const KAREN_KEY_POSITION = { x: -2, y: 3, z: 2 } as const;
/** Blood-red shirt tint for Avaturn look / clothing materials. */
export const KAREN_SHIRT_COLOR = 0x990000;
/** Camera sits this far below the face aim so we look slightly up at her. */
export const KAREN_CAMERA_LOOK_UP = 0.2;

/**
 * Dominant headshot — camera low, looking up at the face.
 * camera @ (0, 1.3, 2.5) looking at (0, 1.5, 0).
 */
export const KAREN_PORTRAIT_CAM = {
  position: { x: 0, y: 1.3, z: 2.5 },
  lookAt: { x: 0, y: 1.5, z: 0 },
} as const;

/** `?debug=true` — Box3Helper + SkeletonHelper + size logs. */
export function isKarenDebugMode(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.search.includes("debug=true")
  );
}

/** Face-locked framing — interrogation close-up, eyes on the user. */
export const KAREN_CAMERA_VIEW = "head" as const;
export const KAREN_CAMERA_OPTS = {
  /** Negative = closer (TalkingHead adds base distance per view). */
  cameraDistance: -0.8,
  cameraY: 0.05,
  /** Negative cameraX pans look-at right → centers a right-biased RPM rig. */
  cameraX: -0.12,
} as const;

/** Start of a question — slightly further. */
export const KAREN_CAMERA_WIDE = {
  cameraDistance: -0.35,
  cameraY: 0.04,
  cameraX: -0.08,
} as const;

/** Uncomfortable close-up while she interrogates. */
export const KAREN_CAMERA_INTERROGATION = {
  cameraDistance: -0.95,
  cameraY: 0.06,
  cameraX: -0.14,
} as const;

const RIM_FURIOUS = 0xff0000;
const RIM_PROUD = 0xd4a017;
/** Default rim — pure blood-red so hair reads against the void. */
const RIM_NEUTRAL = 0xff0000;

export type CreateKarenTalkingHeadOptions = {
  container: HTMLElement;
  mood?: string | null;
  /** Override camera framing. Default: upper-body close-up for chat stage. */
  cameraView?: "full" | "mid" | "upper" | "head";
  onProgress?: (pct: number) => void;
};

type ThreeColor = { setHex: (hex: number) => void; setRGB?: (r: number, g: number, b: number) => void };
type ThreeLight = {
  castShadow?: boolean;
  intensity?: number;
  color?: ThreeColor;
  position?: { set: (x: number, y: number, z: number) => void };
  visible?: boolean;
};

type KarenCinematicLights = {
  /** Key — hard directional from camera-left, sculpts the face. */
  key: DirectionalLight;
  /** Optional hemi — intensity always 0 (ghost-wash killer). */
  hemi?: THREE.HemisphereLight;
  /** Red point rim behind the head — hair/silhouette glow. */
  rim: THREE.PointLight;
  /** @deprecated Ambient fill — never add; kept optional for HMR teardown. */
  fill?: THREE.AmbientLight;
  /** @deprecated Debug blast — never add; kept optional for HMR teardown. */
  debug?: THREE.AmbientLight;
};

type KarenComposer = {
  setSize: (w: number, h: number) => void;
  setPixelRatio?: (n: number) => void;
  render: (delta?: number) => void;
  dispose?: () => void;
};

type HeadWithRenderer = TalkingHead & {
  renderer?: WebGLRenderer & {
    setPixelRatio: (n: number) => void;
    setSize: (w: number, h: number, updateStyle?: boolean) => void;
    getPixelRatio: () => number;
    shadowMap: { enabled: boolean; autoUpdate?: boolean };
    domElement?: HTMLCanvasElement;
  };
  camera?: PerspectiveCamera;
  scene?: Scene;
  controls?: {
    update: () => void;
    target: THREE.Vector3;
  };
  nodeAvatar?: HTMLElement;
  onResize?: () => void;
  render?: () => void;
  isRunning?: boolean;
  lightDirect?: ThreeLight;
  lightSpot?: ThreeLight;
  lightAmbient?: ThreeLight;
  __karenLights?: KarenCinematicLights;
  __karenComposer?: KarenComposer;
  __karenBackdrop?: THREE.Object3D;
  __karenEnvMap?: THREE.Texture;
  /** Calculated eye height after auto-fit (world Y). */
  __karenEyeY?: number;
  __karenHasBlendshapes?: boolean;
  armature?: THREE.Object3D | null;
};

let cameraAnimRaf = 0;

function cancelCameraAnim(): void {
  if (cameraAnimRaf && typeof window !== "undefined") {
    window.cancelAnimationFrame(cameraAnimRaf);
    cameraAnimRaf = 0;
  }
}

/**
 * Failsafe camera — look at the exact center of the model bounding box.
 * Distance = center.z + size.y * 1.5 so we never sit inside the mesh.
 * Falls back to (0, 1.5, 2.5) if no armature/root is ready yet.
 */
export function applyKarenPortraitCamera(
  head: TalkingHead | null | undefined,
  panX = 0,
): void {
  const h = head as HeadWithRenderer | null | undefined;
  const cam = h?.camera;
  if (!cam) return;

  try {
    cam.fov = KAREN_CAMERA_FOV;
    cam.near = 0.1;
    cam.far = 100;

    const host = h as HeadWithRenderer & {
      armature?: THREE.Object3D | null;
      vrm?: { scene?: THREE.Object3D | null } | null;
      __karenModel?: THREE.Object3D | null;
    };
    const root =
      host.armature ?? host.__karenModel ?? host.vrm?.scene ?? null;

    // Rigged figure (e.g. Avaturn): head-and-shoulders on the eye bones, not the whole-body bbox.
    const faceFrame = (h as { __karenFaceFrame?: { aimY: number; dist: number } }).__karenFaceFrame;
    if (faceFrame) {
      // Low camera → look up at the face (dominant / interrogation angle).
      const camY = faceFrame.aimY - KAREN_CAMERA_LOOK_UP;
      cam.position.set(panX, camY, faceFrame.dist);
      cam.lookAt(0, faceFrame.aimY, 0);
      cam.updateProjectionMatrix();
      if (h.controls?.target) {
        h.controls.target.set(0, faceFrame.aimY, 0);
        h.controls.update();
      }
      console.info("[karen/camera] face frame (look-up)", { ...faceFrame, camY });
      return;
    }

    if (root) {
      root.updateWorldMatrix?.(true, true);
      const box = new THREE.Box3().setFromObject(root);
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const dist = Math.max(size.y * 1.5, size.z * 2.0, 1.2);
        const lookY = center.y + size.y * 0.12;
        const camY = lookY - KAREN_CAMERA_LOOK_UP;
        cam.position.set(center.x + panX, camY, center.z + dist);
        cam.lookAt(center.x, lookY, center.z);
        cam.updateProjectionMatrix();

        if (h.controls?.target) {
          h.controls.target.set(center.x, lookY, center.z);
          h.controls.update();
        }

        console.info(
          "[karen/camera] failsafe bbox center=",
          center.toArray(),
          "size=",
          size.toArray(),
          "cam=",
          cam.position.toArray(),
        );
        return;
      }
    }

    cam.position.set(
      panX,
      KAREN_PORTRAIT_CAM.position.y,
      KAREN_PORTRAIT_CAM.position.z,
    );
    cam.lookAt(
      KAREN_PORTRAIT_CAM.lookAt.x,
      KAREN_PORTRAIT_CAM.lookAt.y,
      KAREN_PORTRAIT_CAM.lookAt.z,
    );
    cam.updateProjectionMatrix();
    if (h.controls?.target) {
      h.controls.target.set(
        KAREN_PORTRAIT_CAM.lookAt.x,
        KAREN_PORTRAIT_CAM.lookAt.y,
        KAREN_PORTRAIT_CAM.lookAt.z,
      );
      h.controls.update();
    }
    console.warn("[karen/camera] failsafe used fixed (0,1.3,2.5) → lookAt (0,1.5,0)");
  } catch (err) {
    console.warn("[talkinghead-factory] portrait camera failed", err);
  }
}

/**
 * Temporary debug overlay: bounding box + skeleton + size dump.
 * Enable with `?debug=true`.
 */
export function attachKarenAvatarDebug(
  head: TalkingHead | null | undefined,
): () => void {
  if (!head || !isKarenDebugMode() || typeof window === "undefined") {
    return () => undefined;
  }

  const host = head as HeadWithRenderer & {
    armature?: THREE.Object3D | null;
    scene?: THREE.Scene | null;
    __karenModel?: THREE.Object3D | null;
  };
  const root = host.__karenModel ?? host.armature ?? null;
  const scene = host.scene;
  if (!root || !scene) {
    console.warn("[karen/debug] no armature/scene for helpers");
    return () => undefined;
  }

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  console.log("AVATAR SIZE:", size);
  console.log("AVATAR BOX:", {
    min: box.min.clone(),
    max: box.max.clone(),
    center: box.getCenter(new THREE.Vector3()),
  });

  const boxHelper = new THREE.Box3Helper(box, new THREE.Color(0x00ff88));
  scene.add(boxHelper);

  let skeleton: THREE.SkeletonHelper | null = null;
  try {
    skeleton = new THREE.SkeletonHelper(root);
    (skeleton.material as THREE.LineBasicMaterial).linewidth = 2;
    scene.add(skeleton);
  } catch (err) {
    console.warn("[karen/debug] SkeletonHelper unavailable (static mesh?)", err);
  }

  console.info(
    "%c[karen/debug] ON — Box3Helper + SkeletonHelper. Live yaw: window.setYaw(Math.PI/2)",
    "color:#00ff88;font-weight:900;",
  );

  return () => {
    scene.remove(boxHelper);
    if (skeleton) scene.remove(skeleton);
  };
}

/**
 * Live console knobs — no refresh needed to fix sideways pose.
 *   window.setYaw(0 | Math.PI | Math.PI/2 | -Math.PI/2)
 */
export function exposeKarenDebugConsole(
  head: TalkingHead | null | undefined,
): void {
  if (!head || typeof window === "undefined") return;

  const w = window as unknown as {
    __karenHead?: TalkingHead;
    __karenYaw?: number;
    __cycleKarenYaw?: () => number;
    setYaw?: (val: number) => void;
  };

  w.__karenHead = head;
  w.__karenYaw = MODEL_YAW;

  const host = head as TalkingHead & {
    audioAnalyzerNode?: AnalyserNode;
    __karenReadAmplitude?: () => number;
  };
  host.__karenReadAmplitude = () => {
    const analyser = host.audioAnalyzerNode;
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, data[i]!);
    return peak / 255;
  };
  w.__cycleKarenYaw = () => {
    const next = cycleKarenModelYaw(head);
    w.__karenYaw = next;
    return next;
  };
  w.setYaw = (val: number) => {
    const n = Number(val);
    if (!Number.isFinite(n)) {
      console.warn("[setYaw] expected a number, got", val);
      return;
    }
    applyKarenModelYaw(head, n);
    w.__karenYaw = n;
    console.info("[setYaw] armature.rotation.y =", n);
  };
  // Dev only: flip the same "she is speaking" bus the real voice uses (QA without audio).
  if (process.env.NODE_ENV === "development") {
    (w as { __karenSpeak?: (s: boolean) => void }).__karenSpeak = (s: boolean) =>
      dispatchKarenSpeaking(Boolean(s));
  }
}

/**
 * Mood-driven rim — FURIOUS hot red, PROUD gold, else angry-red default.
 * Key/fill stay cinematic; only rim shifts with mood.
 */
export function applyKarenMoodLighting(
  head: TalkingHead | null | undefined,
  mood: string | null | undefined,
): void {
  const h = head as HeadWithRenderer | null | undefined;
  if (!h) return;
  const keyMood = (mood || "").toUpperCase();
  const furious = keyMood === "ANGRY" || keyMood === "FURIOUS";
  const proud = keyMood === "PROUD";
  const rimHex = furious ? RIM_FURIOUS : proud ? RIM_PROUD : RIM_NEUTRAL;

  try {
    // Mute stock TalkingHead lights — premium 3-point owns the stage.
    if (h.lightAmbient) {
      h.lightAmbient.intensity = 0;
      h.lightAmbient.visible = false;
    }
    if (h.lightDirect) {
      h.lightDirect.intensity = 0;
      h.lightDirect.visible = false;
    }
    if (h.lightSpot) {
      h.lightSpot.intensity = 0;
      h.lightSpot.visible = false;
    }

    const lights = h.__karenLights;
    if (lights) {
      lights.key.intensity = KAREN_KEY_INTENSITY;
      lights.key.position.set(
        KAREN_KEY_POSITION.x,
        KAREN_KEY_POSITION.y,
        KAREN_KEY_POSITION.z,
      );
      if (lights.hemi) {
        lights.hemi.intensity = KAREN_HEMI_INTENSITY;
        lights.hemi.visible = KAREN_HEMI_INTENSITY > 0;
      }
      lights.rim.color.setHex(rimHex);
      lights.rim.position.set(
        KAREN_RIM_POSITION.x,
        KAREN_RIM_POSITION.y,
        KAREN_RIM_POSITION.z,
      );
      lights.rim.intensity = furious
        ? KAREN_RIM_INTENSITY + 0.6
        : proud
          ? KAREN_RIM_INTENSITY - 0.3
          : KAREN_RIM_INTENSITY;
      if (lights.fill) {
        lights.fill.intensity = 0;
        lights.fill.visible = false;
      }
    }
  } catch (err) {
    console.warn("[talkinghead-factory] mood lighting failed", err);
  }
}

/**
 * Cinematic interrogation lighting — soft key (0.5) + red rim (2.0).
 * AmbientLight is stripped (or capped ≤ 0.2) — it flattens PBR into a ghost face.
 * ACESFilmicToneMapping @ exposure 0.8 pulls blown-out whites back.
 */
export function applyKarenCinematicLighting(head: TalkingHead | null | undefined): void {
  const h = head as HeadWithRenderer | null | undefined;
  const scene = h?.scene;
  if (!h || !scene) return;

  try {
    // Remove previous custom lights if re-running.
    if (h.__karenLights) {
      const prev = h.__karenLights;
      scene.remove(prev.key);
      if (prev.key.target) scene.remove(prev.key.target);
      if (prev.hemi) scene.remove(prev.hemi);
      scene.remove(prev.rim);
      const prevRim = prev.rim as THREE.PointLight & { target?: THREE.Object3D };
      if (prevRim.target) scene.remove(prevRim.target);
      if (prev.fill) scene.remove(prev.fill);
      if (prev.debug) scene.remove(prev.debug);
      h.__karenLights = undefined;
    }

    // Strip AmbientLight entirely (TalkingHead default + leftover debug fill).
    const strip: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.AmbientLight) strip.push(obj);
    });
    for (const a of strip) {
      a.removeFromParent();
      (a as THREE.AmbientLight).intensity = 0;
      a.visible = false;
    }

    // Mute leftover stock TalkingHead directs/spots — cinematic set owns the stage.
    if (h.lightAmbient) {
      h.lightAmbient.intensity = 0;
      h.lightAmbient.visible = false;
    }
    if (h.lightDirect) {
      h.lightDirect.intensity = 0;
      h.lightDirect.visible = false;
    }
    if (h.lightSpot) {
      h.lightSpot.intensity = 0;
      h.lightSpot.visible = false;
    }

    const renderer = h.renderer;
    if (renderer) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      if ("toneMappingExposure" in renderer) {
        (renderer as WebGLRenderer & { toneMappingExposure: number }).toneMappingExposure =
          KAREN_TONE_EXPOSURE;
      }
    }

    // Tiny IBL for skin spec only — high intensity washes the face like ambient.
    const envIntensity = 0.04;
    if (renderer && !h.__karenEnvMap) {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envMap = pmrem.fromScene(new RoomEnvironment() as unknown as THREE.Scene, 0.04)
          .texture;
        scene.environment = envMap;
        h.__karenEnvMap = envMap;
        pmrem.dispose();
        if ("environmentIntensity" in scene) {
          (scene as Scene & { environmentIntensity?: number }).environmentIntensity =
            envIntensity;
        }
      } catch (envErr) {
        console.warn("[talkinghead-factory] RoomEnvironment failed", envErr);
      }
    } else if (h.__karenEnvMap) {
      scene.environment = h.__karenEnvMap;
      if ("environmentIntensity" in scene) {
        (scene as Scene & { environmentIntensity?: number }).environmentIntensity =
          envIntensity;
      }
    }

    // Key — top-left @ (-2, 3, 2), intensity 0.5. Sculpts without washing albedo.
    const key = new THREE.DirectionalLight(0xfff2e8, KAREN_KEY_INTENSITY);
    key.position.set(
      KAREN_KEY_POSITION.x,
      KAREN_KEY_POSITION.y,
      KAREN_KEY_POSITION.z,
    );
    key.target.position.set(0, 1.5, 0);
    key.castShadow = false;
    key.name = "karenKey";

    // Red rim — PointLight behind shoulders so hair catches blood-red glow.
    // decay 0: intensity must actually read as a rim, not die to 1/r².
    const rim = new THREE.PointLight(0xff0000, KAREN_RIM_INTENSITY, 12, 0);
    rim.position.set(
      KAREN_RIM_POSITION.x,
      KAREN_RIM_POSITION.y,
      KAREN_RIM_POSITION.z,
    );
    rim.castShadow = false;
    rim.name = "karenRim";

    scene.add(key, key.target, rim);
    h.__karenLights = { key, rim };

    scene.traverse((obj) => {
      const light = obj as THREE.Light & { castShadow?: boolean };
      if (light.isLight && "castShadow" in light) light.castShadow = false;
    });
  } catch (err) {
    console.warn("[talkinghead-factory] cinematic lighting failed", err);
  }
}

/**
 * Tint Avaturn clothing / look materials blood-red (`0x990000`).
 * Textured shirts multiply the tint; untextured ones take the solid color.
 */
export function tintKarenShirtBloodRed(
  root: THREE.Object3D | null | undefined,
  hex: number = KAREN_SHIRT_COLOR,
): void {
  if (!root) return;
  const shirtRe = /(look|shirt|cloth|outfit|top|body_cloth|garment)/i;
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m || !("color" in m)) continue;
      const name = `${m.name || ""} ${obj.name || ""}`;
      if (!shirtRe.test(name)) continue;
      const mat = m as THREE.MeshStandardMaterial;
      mat.color.setHex(hex);
      // Textured albedo — multiply so the map still reads under blood red.
      if (mat.map) {
        mat.color.setHex(hex);
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.needsUpdate = true;
      }
      mat.needsUpdate = true;
    }
  });
}

/** Deep dark stage — rim light needs #0a0a0a so her outline pops. */
export function applyKarenStudioBackground(head: TalkingHead | null | undefined): void {
  const h = head as HeadWithRenderer | null | undefined;
  const scene = h?.scene;
  if (!h || !scene) return;

  try {
    scene.background = new THREE.Color("#0a0a0a");
    // TEMP: fog off during visibility hard-reset (was FogExp2 0.045).
    scene.fog = null;

    // Drop the old podcast plate — clean void behind the rim glow.
    if (h.__karenBackdrop) {
      scene.remove(h.__karenBackdrop);
      h.__karenBackdrop = undefined;
    }
  } catch (err) {
    console.warn("[talkinghead-factory] studio background failed", err);
  }
}

/**
 * Depth-of-field via vanilla `postprocessing` (not @react-three/* — TH owns the canvas).
 * Patches TalkingHead.render so the composer runs each frame.
 */
export async function applyKarenDepthOfField(
  head: TalkingHead | null | undefined,
): Promise<void> {
  const h = head as HeadWithRenderer | null | undefined;
  const renderer = h?.renderer;
  const scene = h?.scene;
  const camera = h?.camera;
  if (!h || !renderer || !scene || !camera) return;
  if (h.__karenComposer) return;

  try {
    const {
      EffectComposer,
      EffectPass,
      RenderPass,
      DepthOfFieldEffect,
      VignetteEffect,
    } = await import("postprocessing");

    const composer = new EffectComposer(renderer, {
      multisampling: 0,
      frameBufferType: THREE.HalfFloatType,
    });
    composer.addPass(new RenderPass(scene, camera));

    const dof = new DepthOfFieldEffect(camera, {
      // Focus near the bust plane (~3.5m portrait distance).
      focusDistance: 0.012,
      focalLength: 0.04,
      bokehScale: 2.4,
      height: 480,
    });

    const vignette = new VignetteEffect({
      darkness: 0.55,
      offset: 0.35,
    });

    composer.addPass(new EffectPass(camera, dof, vignette));

    const node = h.nodeAvatar;
    const cw = Math.max(
      1,
      node?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 1),
    );
    const ch = Math.max(
      1,
      node?.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 1),
    );
    composer.setSize(cw, ch);

    h.__karenComposer = composer;

    const previousRender = typeof h.render === "function" ? h.render.bind(h) : null;
    h.render = () => {
      if (!h.isRunning) return;
      try {
        composer.render();
      } catch (err) {
        console.warn("[talkinghead-factory] composer render failed — raw path", err);
        previousRender?.();
      }
    };
  } catch (err) {
    console.warn("[talkinghead-factory] DOF setup failed", err);
  }
}

function setCameraOpts(
  head: TalkingHead,
  opts: { cameraDistance: number; cameraY: number; cameraX: number },
): void {
  try {
    // Keep TalkingHead’s head-view math for zoom/whip, then force portrait FOV + eye aim.
    head.setView(KAREN_CAMERA_VIEW, { ...opts });
    const panX = (opts.cameraX - KAREN_CAMERA_OPTS.cameraX) * 0.9;
    // Bbox failsafe already aims at model center; only nudge Z for zoom feel.
    applyKarenPortraitCamera(head, panX);
    const h = head as HeadWithRenderer;
    const zDelta = (opts.cameraDistance - KAREN_CAMERA_OPTS.cameraDistance) * -0.55;
    if (h.camera && Math.abs(zDelta) > 1e-4) {
      h.camera.position.z += zDelta;
      if (h.controls?.target) {
        h.camera.lookAt(h.controls.target);
      }
      h.controls?.update?.();
    }
  } catch (err) {
    console.warn("[talkinghead-factory] setView failed", err);
  }
}

/**
 * Slow zoom into an uncomfortable close-up (question phase).
 * Interpolates wide → interrogation over `durationMs`.
 */
export function animateKarenInterrogationZoom(
  head: TalkingHead | null | undefined,
  durationMs = 2200,
): void {
  if (!head || typeof window === "undefined") return;
  cancelCameraAnim();
  const from = KAREN_CAMERA_WIDE;
  const to = KAREN_CAMERA_INTERROGATION;
  const start = performance.now();

  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const e = 1 - Math.pow(1 - t, 3); // ease-out
    setCameraOpts(head, {
      cameraDistance: from.cameraDistance + (to.cameraDistance - from.cameraDistance) * e,
      cameraY: from.cameraY + (to.cameraY - from.cameraY) * e,
      cameraX: from.cameraX + (to.cameraX - from.cameraX) * e,
    });
    if (t < 1) cameraAnimRaf = window.requestAnimationFrame(tick);
    else cameraAnimRaf = 0;
  };

  setCameraOpts(head, { ...from });
  cameraAnimRaf = window.requestAnimationFrame(tick);
}

/** Snap back to wide framing (between questions / idle). */
export function setKarenCameraWide(head: TalkingHead | null | undefined): void {
  cancelCameraAnim();
  if (!head) return;
  setCameraOpts(head, { ...KAREN_CAMERA_WIDE });
}

const SPEAK_PUSH_FACTOR = 0.82; // pull in ~18% toward bbox center
let speakZoomRaf = 0;
let speakRestZ: number | null = null;

/** Forget the captured push-in rest distance (call after the stage layout changes). */
export function resetKarenSpeakRest(): void {
  speakRestZ = null;
}

/**
 * Kokoro speak push-in — relative to failsafe bbox distance.
 * Keeps lookAt on controls.target (bbox center).
 */
export function animateKarenSpeakPushIn(
  head: TalkingHead | null | undefined,
  speaking: boolean,
  durationMs = 420,
): void {
  if (!head || typeof window === "undefined") return;
  const h = head as HeadWithRenderer;
  const cam = h.camera;
  if (!cam) return;

  if (speakZoomRaf) {
    window.cancelAnimationFrame(speakZoomRaf);
    speakZoomRaf = 0;
  }

  const target = h.controls?.target ?? new THREE.Vector3(0, cam.position.y, 0);
  if (speakRestZ == null || !speaking) {
    // Capture rest Z from current failsafe framing when idle / starting speak.
    if (!speaking && speakRestZ == null) speakRestZ = cam.position.z;
    if (speaking && speakRestZ == null) speakRestZ = cam.position.z;
  }
  const restZ = speakRestZ ?? cam.position.z;
  const pushZ = target.z + (restZ - target.z) * SPEAK_PUSH_FACTOR;
  const fromZ = cam.position.z;
  const toZ = speaking ? pushZ : restZ;
  const aimY = target.y;
  const start = performance.now();

  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const e = speaking ? 1 - Math.pow(1 - t, 3) : t * t * (3 - 2 * t);
    cam.position.set(cam.position.x, aimY, fromZ + (toZ - fromZ) * e);
    cam.near = 0.1;
    cam.far = 100;
    cam.lookAt(target.x, aimY, target.z);
    cam.updateProjectionMatrix();
    if (t < 1) speakZoomRaf = window.requestAnimationFrame(tick);
    else {
      speakZoomRaf = 0;
      cam.position.set(cam.position.x, aimY, toZ);
      cam.lookAt(target.x, aimY, target.z);
      if (!speaking) speakRestZ = toZ;
    }
  };

  speakZoomRaf = window.requestAnimationFrame(tick);
}

/** Console visibility dump after load. */
export function logKarenAvatarVisibility(
  head: TalkingHead | null | undefined,
): void {
  if (!head) {
    console.warn("AVATAR VISIBLE: false (no head)");
    return;
  }
  const host = head as HeadWithArmature & {
    avatar?: unknown;
    __karenModel?: THREE.Object3D | null;
  };
  const root = host.armature ?? host.__karenModel ?? host.vrm?.scene ?? null;
  let boxInfo: { center: number[]; size: number[] } | null = null;
  if (root) {
    try {
      root.updateWorldMatrix?.(true, true);
      const box = new THREE.Box3().setFromObject(root);
      if (!box.isEmpty()) {
        boxInfo = {
          center: box.getCenter(new THREE.Vector3()).toArray(),
          size: box.getSize(new THREE.Vector3()).toArray(),
        };
      }
    } catch {
      /* ignore */
    }
  }
  console.log(
    "AVATAR VISIBLE:",
    host.avatar !== undefined || Boolean(root),
    "SCALE:",
    root?.scale?.clone?.() ?? root?.scale,
    "BBOX:",
    boxInfo,
  );
}

type HeadWithArmature = TalkingHead & {
  armature?: THREE.Object3D | null;
  vrm?: { scene?: THREE.Object3D | null } | null;
  scene?: THREE.Object3D | null;
  /** Tripo / custom GLB root. */
  __karenModel?: THREE.Object3D | null;
  /** TalkingHead config bag — NOT a Three.js mesh. Do not rotate this. */
  avatar?: Record<string, unknown> | null;
  __karenFacingYaw?: number;
  /** Mute Protocol / cold shoulder — keep her back to camera. */
  __karenFacingAway?: boolean;
};

/** True Three.js roots we can yaw — never `head.avatar` (that's showAvatar opts). */
function karenFacingRoots(head: HeadWithArmature): THREE.Object3D[] {
  const roots: THREE.Object3D[] = [];
  const push = (obj: THREE.Object3D | null | undefined) => {
    if (obj && typeof obj.rotation?.set === "function" && !roots.includes(obj)) {
      roots.push(obj);
    }
  };
  push(head.armature ?? null);
  push(head.vrm?.scene ?? null);
  push(head.__karenModel ?? null);
  return roots;
}

/**
 * Cold shoulder / Mute Protocol — rotate the 3D root 180° from the export facing
 * fix so Karen turns her back. Restores camera-facing when `away` is false.
 */
export function setKarenFacingAway(
  head: TalkingHead | null | undefined,
  away: boolean,
): void {
  if (!head) return;
  try {
    const host = head as HeadWithArmature;
    const base =
      typeof host.__karenFacingYaw === "number" ? host.__karenFacingYaw : MODEL_YAW;
    const yaw = away ? base + Math.PI : base;
    host.__karenFacingAway = away;
    for (const root of karenFacingRoots(host)) {
      root.rotation.y = yaw;
    }
  } catch {
    /* ignore */
  }
}

/** Loud-WAV head snap — radians. Back first, then whip forward. */
export const KAREN_RECOIL_BACK_X = -0.15;
export const KAREN_RECOIL_FORWARD_X = 0.1;
export const KAREN_RECOIL_TILT_Z = 0.08;
export const KAREN_RECOIL_MS = 280;

type RecoilHost = HeadWithArmature & {
  __karenHitUntil?: number;
  __karenRecoilGen?: number;
};

/**
 * Violent 3D recoil on a loud WAV / scream:
 * snap `armature.rotation.x` back by −0.15 rad, whip forward, with a slight
 * `rotation.z` tilt so she looks unhinged. Locks lookAt briefly via `__karenHitUntil`.
 */
export function snapKarenHeadRecoil(
  head: object | null | undefined,
  opts: { tilt?: number } = {},
): boolean {
  if (typeof window === "undefined" || !head) return false;
  const host = head as RecoilHost;
  const root =
    host.armature ?? host.__karenModel ?? host.vrm?.scene ?? null;
  if (!root || typeof root.rotation?.x !== "number") return false;

  const restX = root.rotation.x;
  const restZ = typeof root.rotation.z === "number" ? root.rotation.z : 0;
  const tilt =
    typeof opts.tilt === "number"
      ? opts.tilt
      : KAREN_RECOIL_TILT_Z * (Math.random() < 0.5 ? -1 : 1);
  const gen = (host.__karenRecoilGen ?? 0) + 1;
  host.__karenRecoilGen = gen;
  const t0 = performance.now();
  host.__karenHitUntil = t0 + KAREN_RECOIL_MS;

  const tick = (now: number) => {
    if (host.__karenRecoilGen !== gen) return;
    const u = Math.min(1, (now - t0) / KAREN_RECOIL_MS);
    // 0–0.35: snap back + tilt · 0.35–0.7: whip forward · 0.7–1: settle
    let x = restX;
    let z = restZ;
    if (u < 0.35) {
      const w = u / 0.35;
      const e = 1 - (1 - w) * (1 - w);
      x = restX + KAREN_RECOIL_BACK_X * e;
      z = restZ + tilt * e;
    } else if (u < 0.7) {
      const w = (u - 0.35) / 0.35;
      const e = w * w;
      x =
        restX +
        KAREN_RECOIL_BACK_X +
        (KAREN_RECOIL_FORWARD_X - KAREN_RECOIL_BACK_X) * e;
      z = restZ + tilt * (1 - e * 0.35);
    } else {
      const w = (u - 0.7) / 0.3;
      const e = 1 - (1 - w) * (1 - w);
      x = restX + KAREN_RECOIL_FORWARD_X * (1 - e);
      z = restZ + tilt * (1 - e);
    }
    root.rotation.x = x;
    root.rotation.z = z;
    if (u < 1) {
      requestAnimationFrame(tick);
      return;
    }
    root.rotation.x = restX;
    root.rotation.z = restZ;
  };
  requestAnimationFrame(tick);
  return true;
}

/**
 * Force the loaded avatar to face the camera (export-axis correction).
 * TalkingHead.avatar is config — rotate armature / vrm.scene instead.
 *
 * Permanent lock: Avaturn figure exports face −Z; camera looks down +Z toward
 * origin, so we need Math.PI (180°) on Y. Use -Math.PI only if a future export
 * flips the other way (same visual result for a single turn).
 */
export function applyKarenFacingCorrection(
  head: TalkingHead | null | undefined,
  yaw: number = MODEL_YAW,
): void {
  if (!head) return;
  try {
    const host = head as HeadWithArmature;
    // Force the model to face the camera
    if (host.armature) {
      host.armature.rotation.y = yaw;
    }
    if (host.vrm && host.vrm.scene) {
      host.vrm.scene.rotation.y = yaw;
    }
    // Also hit any other discovered roots (deduped).
    for (const root of karenFacingRoots(host)) {
      root.rotation.y = yaw;
    }
    host.__karenFacingYaw = yaw;
    MODEL_YAW = yaw;
    console.info(
      "[talkinghead-factory] MODEL_YAW=",
      yaw,
      "armature=",
      Boolean(host.armature),
      "vrm.scene=",
      Boolean(host.vrm?.scene),
    );
  } catch (err) {
    console.warn("[talkinghead-factory] facing correction failed", err);
  }
}

/** True when the model URL is a VRM. */
export function isKarenVrmUrl(url: string): boolean {
  return /\.vrm($|\?)/i.test(url);
}

/**
 * Prefer `/models/karen.vrm` when present; else fall back to karen.glb.
 * HEAD can hang on some Next static 404s — hard-timeout and fall through.
 */
export async function resolveKarenModelUrl(): Promise<string> {
  if (typeof window === "undefined") return KAREN_GLB_URL;
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(KAREN_VRM_URL, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      cache: "no-cache",
      signal: ctrl.signal,
    });
    window.clearTimeout(timer);
    // 200 / 206 = present; 404 / abort → GLB.
    if (res.ok || res.status === 206) return KAREN_VRM_URL;
  } catch {
    /* missing or timed out */
  }
  console.info("[talkinghead-factory] karen.vrm missing — using", KAREN_GLB_URL);
  return KAREN_GLB_URL;
}

/**
 * Load avatar via VRM (`loadVRM`) or GLB (`showAvatar` / TalkingHead loadGLTF path).
 * ReadyPlayerMe: drop ARKit GLB at `/models/karen.glb` — jawOpen + viseme_aa map automatically.
 */
export async function loadKarenAvatarModel(
  head: TalkingHead,
  url: string,
  opts: {
    mood?: string | null;
    onProgress?: (pct: number) => void;
  } = {},
): Promise<void> {
  const progress = (ev: ProgressEvent) => {
    if (!opts.onProgress || !ev.lengthComputable) return;
    opts.onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
  };

  const avatarOpts = {
    url,
    body: "F" as const,
    avatarMood: mapChatMoodToTalkingHead(opts.mood),
    lipsyncLang: "en",
    avatarMute: true,
  };

  const host = head as TalkingHead & {
    loadVRM?: (
      u: string,
      onprogress?: ((ev: ProgressEvent) => void) | null,
    ) => Promise<void>;
  };

  if (isKarenVrmUrl(url) && typeof host.loadVRM === "function") {
    await host.loadVRM(url, progress);
  } else if (isKarenVrmUrl(url)) {
    // First VRM load installs head.loadVRM inside showAvatar.
    await head.showAvatar(avatarOpts, progress);
  } else {
    await head.showAvatar(avatarOpts, progress);
  }

  // Immediately after loadVRM / showAvatar — face the camera (not the wall).
  applyKarenFacingCorrection(head, KAREN_MODEL_FACING_YAW);
}

/**
 * Whip pan on roast delivery — quick left/right cameraX jolts, then settle.
 */
export function animateKarenWhipPan(
  head: TalkingHead | null | undefined,
  durationMs = 420,
): void {
  if (!head || typeof window === "undefined") return;
  cancelCameraAnim();
  const base = KAREN_CAMERA_INTERROGATION;
  const start = performance.now();
  // Keyframed X offsets for a sharp whip.
  const keys: Array<{ t: number; x: number }> = [
    { t: 0, x: base.cameraX },
    { t: 0.15, x: base.cameraX - 0.35 },
    { t: 0.35, x: base.cameraX + 0.4 },
    { t: 0.55, x: base.cameraX - 0.28 },
    { t: 0.75, x: base.cameraX + 0.18 },
    { t: 1, x: base.cameraX },
  ];

  const sampleX = (u: number) => {
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i]!;
      const b = keys[i + 1]!;
      if (u >= a.t && u <= b.t) {
        const p = (u - a.t) / (b.t - a.t || 1);
        return a.x + (b.x - a.x) * p;
      }
    }
    return base.cameraX;
  };

  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    setCameraOpts(head, {
      cameraDistance: base.cameraDistance,
      cameraY: base.cameraY,
      cameraX: sampleX(t),
    });
    if (t < 1) cameraAnimRaf = window.requestAnimationFrame(tick);
    else cameraAnimRaf = 0;
  };

  cameraAnimRaf = window.requestAnimationFrame(tick);
}

/** Effective DPR after mobile-safe clamp. */
export function karenClampedPixelRatio(
  dpr: number = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
): number {
  return Math.min(Math.max(dpr, 1), KAREN_MAX_PIXEL_RATIO);
}

/**
 * TalkingHead does `setPixelRatio(modelPixelRatio * devicePixelRatio)`.
 * Pass the factor that makes the product equal our clamped ratio.
 */
export function karenModelPixelRatioOption(
  dpr: number = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
): number {
  const safeDpr = Math.max(dpr, 0.01);
  return karenClampedPixelRatio(safeDpr) / safeDpr;
}

/**
 * Force WebGL canvas to the full browser viewport.
 * Call right after TalkingHead construct — 0×0 containers make her invisible.
 */
export function forceKarenRendererFullscreen(
  head: TalkingHead | null | undefined,
): void {
  const h = head as HeadWithRenderer | null | undefined;
  const renderer = h?.renderer;
  if (!renderer || typeof window === "undefined") return;

  const w = Math.max(1, window.innerWidth);
  const ht = Math.max(1, window.innerHeight);
  // Mobile Retina can be 3× — clamp hard for 60fps.
  const ratio = Math.min(window.devicePixelRatio || 1, KAREN_MAX_PIXEL_RATIO);

  // Exact viewport lock — never trust a 0×0 parent container.
  renderer.setSize(w, ht);
  renderer.setPixelRatio(ratio);

  if (h.camera) {
    h.camera.aspect = w / ht;
    h.camera.updateProjectionMatrix();
  }
  h.__karenComposer?.setSize(w, ht);
  h.__karenComposer?.setPixelRatio?.(ratio);

  const canvas = renderer.domElement;
  if (canvas) {
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    // iOS Safari: stop page scroll / rubber-band while the user holds the mic.
    canvas.style.touchAction = "none";
    (canvas.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect =
      "none";
    canvas.style.userSelect = "none";
  }
}

/**
 * Clamp pixel ratio, keep shadows off, sync canvas to container size.
 * Safe to call after construct and on every resize.
 */
export function optimizeKarenRenderer(head: TalkingHead | null | undefined): void {
  const h = head as HeadWithRenderer | null | undefined;
  const renderer = h?.renderer;
  if (!renderer || typeof window === "undefined") return;

  // Keep new PBR materials from washing out / crushing under cinematic lights.
  try {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    if ("toneMappingExposure" in renderer) {
      (renderer as WebGLRenderer & { toneMappingExposure: number }).toneMappingExposure =
        KAREN_TONE_EXPOSURE;
    }
  } catch {
    /* older three builds */
  }

  // Studio / TikTok look — no dynamic shadow maps (mobile killers).
  renderer.shadowMap.enabled = false;
  if ("autoUpdate" in renderer.shadowMap) {
    renderer.shadowMap.autoUpdate = false;
  }
  if (h.lightDirect) h.lightDirect.castShadow = false;
  if (h.lightSpot) h.lightSpot.castShadow = false;
  if (h.lightAmbient && "castShadow" in h.lightAmbient) {
    (h.lightAmbient as ThreeLight).castShadow = false;
  }
  const custom = h.__karenLights;
  if (custom) {
    custom.key.castShadow = false;
    if (custom.hemi) custom.hemi.castShadow = false;
    custom.rim.castShadow = false;
  }

  // Always fullscreen — never shrink to a 0×0 React parent.
  forceKarenRendererFullscreen(head);
  if (h.camera) {
    h.camera.fov = KAREN_CAMERA_FOV;
    h.camera.near = KAREN_CAMERA_NEAR;
    h.camera.far = KAREN_CAMERA_FAR;
    h.camera.updateProjectionMatrix();
  }
  h.controls?.update?.();
}

/**
 * Window + orientation resize → TalkingHead.onResize + re-clamp DPR.
 * Returns an unsubscribe fn for React cleanup.
 */
export function attachKarenRendererResize(
  head: TalkingHead | null | undefined,
): () => void {
  if (!head || typeof window === "undefined") return () => undefined;

  let raf = 0;
  const onWindowResize = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      optimizeKarenRenderer(head);
    });
  };

  window.addEventListener("resize", onWindowResize, { passive: true });
  window.addEventListener("orientationchange", onWindowResize, { passive: true });
  // One sync pass in case layout settled after mount.
  onWindowResize();

  return () => {
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("orientationchange", onWindowResize);
    if (raf) window.cancelAnimationFrame(raf);
  };
}

/**
 * Create + show Karen's avatar with SaaS-tuned defaults.
 * Prefers `/models/karen.vrm` via `loadVRM`; falls back to Tripo `karen.glb`
 * (static mesh — not Mixamo). Set `KAREN_USES_TRIPO_MESH` to force Tripo always.
 */
export async function createKarenTalkingHead(
  opts: CreateKarenTalkingHeadOptions,
): Promise<TalkingHead> {
  const modelUrl = KAREN_USES_TRIPO_MESH
    ? KAREN_GLB_URL
    : await resolveKarenModelUrl();
  const usingVrm = isKarenVrmUrl(modelUrl);

  // Static Tripo GLB has no Mixamo rig — keep the dedicated Three.js path.
  if (KAREN_USES_TRIPO_MESH || !usingVrm) {
    if (!usingVrm) {
      console.info(
        "[talkinghead-factory] no karen.vrm yet — Tripo GLB fallback",
        modelUrl,
      );
    }
    const { createKarenTripoAvatar } = await import("@/lib/karen/tripo-avatar");
    return createKarenTripoAvatar({
      container: opts.container,
      mood: opts.mood,
      modelUrl: KAREN_GLB_URL,
      onProgress: opts.onProgress,
    });
  }

  const { TalkingHead: TalkingHeadCtor } = await import("@met4citizen/talkinghead");

  const view = opts.cameraView ?? KAREN_CAMERA_VIEW;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  const headOpts: TalkingHeadOptions = {
    ttsEndpoint: "",
    ttsApikey: null,
    lipsyncModules: [],
    lipsyncLang: "en",
    cameraView: view,
    cameraDistance: KAREN_CAMERA_OPTS.cameraDistance,
    cameraX: KAREN_CAMERA_OPTS.cameraX,
    cameraY: KAREN_CAMERA_OPTS.cameraY,
    cameraRotateEnable: true,
    cameraPanEnable: false,
    cameraZoomEnable: false,
    modelPixelRatio: karenModelPixelRatioOption(dpr),
    lightAmbientColor: 0x000000,
    lightAmbientIntensity: 0,
    lightDirectColor: 0xffffff,
    lightDirectIntensity: 0,
    lightSpotColor: RIM_FURIOUS,
    lightSpotIntensity: 0,
    avatarIdleEyeContact: 0.55,
    avatarSpeakingEyeContact: 0.85,
    avatarListeningEyeContact: 0.7,
  };

  const prevCreateImageBitmap = globalThis.createImageBitmap;
  const forceTextureLoader = () => {
    try {
      // @ts-expect-error intentional — GLTFLoader checks typeof createImageBitmap
      delete globalThis.createImageBitmap;
    } catch {
      /* ignore */
    }
  };
  const restoreImageBitmap = () => {
    if (prevCreateImageBitmap) {
      globalThis.createImageBitmap = prevCreateImageBitmap;
    }
  };

  forceTextureLoader();
  try {
    const head = new TalkingHeadCtor(opts.container, headOpts);

    try {
      const { LipsyncEn } = await import(
        /* webpackChunkName: "karen-lipsync-en" */
        "@met4citizen/talkinghead/modules/lipsync-en.mjs"
      );
      const lipHost = head as TalkingHead & { lipsync?: Record<string, unknown> };
      lipHost.lipsync = { ...(lipHost.lipsync || {}), en: new LipsyncEn() };
    } catch (err) {
      console.warn("[talkinghead-factory] LipsyncEn inject failed", err);
    }

    optimizeKarenRenderer(head);

    forceTextureLoader();
    console.info("[talkinghead-factory] loading", modelUrl, "(VRM → loadVRM)");

    // Ensure loadVRM exists before first VRM request (patch also installs it).
    const hostLoad = head as TalkingHead & {
      loadVRM?: (
        u: string,
        onprogress?: ((ev: ProgressEvent) => void) | null,
      ) => Promise<void>;
    };
    if (typeof hostLoad.loadVRM !== "function") {
      hostLoad.loadVRM = async (u, onprogress = null) => {
        await head.showAvatar(
          {
            url: u,
            body: "F",
            avatarMood: mapChatMoodToTalkingHead(opts.mood),
            lipsyncLang: "en",
            avatarMute: true,
          },
          onprogress ?? undefined,
        );
      };
    }

    await loadKarenAvatarModel(head, modelUrl, {
      mood: opts.mood,
      onProgress: opts.onProgress,
    });

    optimizeKarenRenderer(head);

    // VRM / RPM GLB — verify morphs; fake shout if jawOpen / viseme_* missing.
    try {
      const host = head as HeadWithRenderer & {
        hasBlendshapes?: boolean;
        isSpeaking?: boolean;
      };
      const reportRoot = host.armature ?? host.scene;
      if (reportRoot) {
        const {
          verifyKarenBlendshapes,
          mapKarenLipMorphTargets,
        } = await import("@/lib/karen/avatar-fit");
        const report = verifyKarenBlendshapes(reportRoot);
        host.__karenHasBlendshapes = report.ok;
        host.hasBlendshapes = report.ok;
        console.log(
          "MORPH TARGETS:",
          report.dictionaries.flatMap((d) => d.keys),
        );
        // Real fix path: map jawOpen + viseme_aa when the RPM GLB has them.
        mapKarenLipMorphTargets(reportRoot);
        const { attachKarenShoutFallback } = await import(
          "@/lib/karen/shout-fallback"
        );
        attachKarenShoutFallback(host);
      }
    } catch (err) {
      console.warn("[talkinghead-factory] blendshape verify failed", err);
    }

    head.setView(view, { ...KAREN_CAMERA_OPTS });
    applyKarenCinematicLighting(head);
    applyKarenStudioBackground(head);
    applyKarenMoodLighting(head, opts.mood);
    try {
      const host = head as HeadWithRenderer & {
        armature?: THREE.Object3D | null;
        __karenModel?: THREE.Object3D | null;
      };
      tintKarenShirtBloodRed(host.armature ?? host.__karenModel ?? host.scene ?? null);
    } catch (tintErr) {
      console.warn("[talkinghead-factory] shirt tint failed", tintErr);
    }
    // TEMP: skip DOF while diagnosing black screen (wrong focus = black frame).
    // await applyKarenDepthOfField(head);
    // Canvas size AFTER load — 0×0 parents before load hide the avatar.
    forceKarenRendererFullscreen(head);
    optimizeKarenRenderer(head);

    // AFTER setView — re-assert profile facing so setView can't leave her backwards.
    applyKarenFacingCorrection(head, KAREN_MODEL_FACING_YAW);
    applyKarenPortraitCamera(head);

    applyExpressionToTalkingHead(head, opts.mood ?? "SARCASTIC", { isSpeaking: false });
    lockAggressiveBrows(head);
    try {
      head.setMood(mapChatMoodToTalkingHead(opts.mood));
    } catch {
      /* mood morph may be missing on some rigs */
    }
    lockAggressiveBrows(head);

    logKarenAvatarVisibility(head);
    attachKarenAvatarDebug(head);
    exposeKarenDebugConsole(head);

    return head;
  } finally {
    restoreImageBitmap();
  }
}

/**
 * Soft mouse / pointer gaze so Karen looks at the user.
 * Call from a `pointermove` listener; `t` is look-at blend duration in ms.
 */
export function trackPointerGaze(
  // Accepts TalkingHead or the lighter TalkingHeadLike registered by voice.ts.
  head: object | null | undefined,
  clientX: number,
  clientY: number,
  t = 900,
): void {
  const gaze = head as
    | { lookAt?: (x: number, y: number, t?: number) => void }
    | null
    | undefined;
  if (!gaze || typeof gaze.lookAt !== "function") return;
  try {
    gaze.lookAt(clientX, clientY, t);
  } catch (err) {
    console.warn("[talkinghead-factory] lookAt failed", err);
  }
}

/**
 * Global battery save — pause Three.js render loop when tab/page is hidden
 * or the user leaves the Karen stage. Pair with resumeKarenRuntime.
 */
export function pauseKarenRuntime(head: TalkingHead | null | undefined): void {
  if (!head) return;
  try {
    head.stop?.();
  } catch {
    /* ignore */
  }
  const host = head as HeadWithRenderer & { audioCtx?: AudioContext; isRunning?: boolean };
  host.isRunning = false;
  const ctx = host.audioCtx;
  if (ctx && ctx.state === "running") {
    void ctx.suspend().catch(() => undefined);
  }
}

/** Resume render loop + AudioContext after visibility / modal return. */
export function resumeKarenRuntime(head: TalkingHead | null | undefined): void {
  if (!head) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return;
  }
  const host = head as HeadWithRenderer & { audioCtx?: AudioContext };
  const ctx = host.audioCtx;
  if (ctx && (ctx.state === "suspended" || (ctx.state as string) === "interrupted")) {
    void ctx.resume().catch(() => undefined);
  }
  try {
    head.start?.();
  } catch {
    /* ignore */
  }
}
