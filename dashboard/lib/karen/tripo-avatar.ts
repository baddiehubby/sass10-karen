"use client";

/**
 * Tripo / meshopt (or any static) GLB avatar for Karen.
 * Auto-fits scale + eye camera, verifies ARKit morphs, falls back to body-language
 * bob/anger tilt when blendshapes are missing.
 */

import type { TalkingHead } from "@met4citizen/talkinghead";
import { MeshoptDecoder } from "meshoptimizer";
import { KAREN_DEV, karenDevLog, karenDevWarn } from "@/lib/karen/dev-log";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { KAREN_ACTIVE_PROFILE } from "@/lib/karen/avatar-assets";
import {
  fitKarenAvatarToStage,
  karenProceduralMouthEnergy,
  mapKarenLipMorphTargets,
  relaxKarenFigureArms,
  setMorphWeight,
  verifyKarenBlendshapes,
  type KarenBlendshapeReport,
} from "@/lib/karen/avatar-fit";
import { attachKarenShoutFallback } from "@/lib/karen/shout-fallback";
import {
  applyKarenCinematicLighting,
  applyKarenMoodLighting,
  applyKarenPortraitCamera,
  applyKarenStudioBackground,
  attachKarenAvatarDebug,
  exposeKarenDebugConsole,
  forceKarenRendererFullscreen,
  logKarenAvatarVisibility,
  tintKarenShirtBloodRed,
  KAREN_CAMERA_FAR,
  KAREN_CAMERA_FOV,
  KAREN_CAMERA_NEAR,
  KAREN_GLB_URL,
  KAREN_CAMERA_LOOK_UP,
  KAREN_PORTRAIT_CAM,
  KAREN_TONE_EXPOSURE,
  MODEL_YAW,
  resetKarenSpeakRest,
  karenClampedPixelRatio,
} from "@/lib/karen/talkinghead-factory";
import { dispatchKarenSpeaking, subscribeKarenSpeaking } from "@/lib/karen/talkinghead-bus";
import {
  KAREN_AGGRESSIVE_BROW,
  mapChatMoodToTalkingHead,
} from "@/lib/karen/expression-bridge";

export type CreateKarenTripoAvatarOptions = {
  container: HTMLElement;
  mood?: string | null;
  modelUrl?: string;
  onProgress?: (pct: number) => void;
};

type TripoHead = TalkingHead & {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  audioCtx: AudioContext;
  audioAnalyzerNode: AnalyserNode;
  nodeAvatar: HTMLElement;
  armature: THREE.Object3D;
  morphs?: Record<string, unknown>;
  controls: {
    update: () => void;
    target: THREE.Vector3;
    enableZoom: boolean;
    enableRotate: boolean;
    enablePan: boolean;
  };
  isRunning: boolean;
  isSpeaking: boolean;
  hasBlendshapes: boolean;
  lightAmbient: THREE.AmbientLight;
  lightDirect: THREE.DirectionalLight;
  lightSpot: THREE.SpotLight;
  __karenModel: THREE.Object3D;
  __karenEyeY: number;
  __karenHasBlendshapes: boolean;
  __karenAngry: boolean;
  __karenFacingAway?: boolean;
  __speakUntil: number;
  __karenHitUntil?: number;
  __karenReadAmplitude: () => number;
  start: () => void;
  stop: () => void;
  setView: (view?: string, opt?: Record<string, number>) => void;
  setMood: (mood: string) => void;
  lookAt: (x: number, y: number, t?: number) => void;
  speakAudio: (
    audio: { audio?: AudioBuffer; words?: string[]; wtimes?: number[]; wdurations?: number[] },
    opt?: Record<string, unknown> | null,
  ) => void;
  onResize: () => void;
  render: () => void;
};

function getAudioCtor(): typeof AudioContext {
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  );
}

function hardenMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.castShadow = false;
    obj.receiveShadow = false;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m) continue;
      if ("map" in m && m.map) {
        m.map.colorSpace = THREE.SRGBColorSpace;
        m.map.needsUpdate = true;
      }
      if ("emissiveMap" in m && m.emissiveMap) {
        m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      }
      // Kill the plastic Avaturn/VRM shine — matte skin under cinematic lights.
      if ("roughness" in m && typeof m.roughness === "number") {
        (m as THREE.MeshStandardMaterial).roughness = 0.8;
      }
      if ("metalness" in m && typeof m.metalness === "number") {
        (m as THREE.MeshStandardMaterial).metalness = 0.1;
      }
      if ("envMapIntensity" in m) {
        // Low IBL so ACES doesn't wash the albedo map.
        (m as THREE.MeshStandardMaterial).envMapIntensity = 0.35;
      }
      m.needsUpdate = true;
    }
  });
}

/**
 * Load GLB → auto-fit → cinematic stage. TalkingHead-compatible shim.
 */
export async function createKarenTripoAvatar(
  opts: CreateKarenTripoAvatarOptions,
): Promise<TalkingHead> {
  const url = opts.modelUrl ?? KAREN_GLB_URL;
  const node = opts.container;
  node.replaceChildren();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    KAREN_CAMERA_FOV,
    Math.max(1, node.clientWidth || window.innerWidth) /
      Math.max(1, node.clientHeight || window.innerHeight),
    KAREN_CAMERA_NEAR,
    KAREN_CAMERA_FAR,
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 1.5),
  );
  // Full viewport — never trust a 0×0 parent during first paint.
  renderer.setSize(
    Math.max(1, window.innerWidth),
    Math.max(1, window.innerHeight),
  );
  // Prevent washed-out / too-dark PBR under cinematic lights.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = KAREN_TONE_EXPOSURE;
  renderer.shadowMap.enabled = false;
  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";
  canvas.style.userSelect = "none";
  (canvas.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect =
    "none";
  node.appendChild(canvas);

  const audioCtx = new (getAudioCtor())();

  const lightAmbient = new THREE.AmbientLight(0x000000, 0);
  lightAmbient.visible = false;
  const lightDirect = new THREE.DirectionalLight(0xffffff, 0);
  const lightSpot = new THREE.SpotLight(0xff0000, 0);
  // Do not add AmbientLight — it washes PBR albedo into a ghost-white face.
  scene.add(lightDirect, lightSpot);

  await MeshoptDecoder.ready;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const gltf = await new Promise<Awaited<ReturnType<GLTFLoader["loadAsync"]>>>(
    (resolve, reject) => {
      loader.load(
        url,
        resolve,
        (ev) => {
          if (!opts.onProgress || !ev.lengthComputable) return;
          opts.onProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
        },
        reject,
      );
    },
  );

  const model = gltf.scene;
  hardenMaterials(model);
  tintKarenShirtBloodRed(model);

  // TASK 1 — bounding-box auto-scale + X/Z center + face-camera yaw.
  // Rigged figures ship in T-pose — relax the arms BEFORE fitting so bounds are the final pose.
  if (KAREN_ACTIVE_PROFILE.kind === "figure" && KAREN_ACTIVE_PROFILE.armDrop) {
    const moved = relaxKarenFigureArms(model, KAREN_ACTIVE_PROFILE.armDrop);
    console.info("[karen/avatar] relaxed T-pose arms", { bones: moved, radians: KAREN_ACTIVE_PROFILE.armDrop });
  }
  const fit = fitKarenAvatarToStage(model);
  // Force the model to face the camera (Avaturn figure exports are camera-backwards).
  // Profile facingYaw is Math.PI for v4; lock it again after fit so nothing reverts.
  const faceYaw =
    typeof KAREN_ACTIVE_PROFILE.facingYaw === "number"
      ? KAREN_ACTIVE_PROFILE.facingYaw
      : Math.PI;
  model.rotation.y = faceYaw;
  scene.add(model);
  console.info("[karen/avatar] Fitted GLB", {
    url,
    scale: Number(fit.scale.toFixed(3)),
    height: Number(fit.height.toFixed(3)),
    eyeY: Number(fit.eyeY.toFixed(3)),
    facingYaw: faceYaw,
  });

  // TASK 2 — blendshape verification.
  const blend: KarenBlendshapeReport = verifyKarenBlendshapes(model);
  const morphs: Record<string, number> = {};
  for (const d of blend.dictionaries) {
    for (const k of d.keys) morphs[k] = 0;
  }

  const eyeY = fit.eyeY;
  // Rigged figures frame on the face; static busts keep the original portrait camera.
  const faceFrame = fit.face ?? null;
  const baseZ = faceFrame ? faceFrame.dist : KAREN_PORTRAIT_CAM.position.z;
  const controls = {
    target: new THREE.Vector3(0, eyeY, 0),
    enableZoom: false,
    enableRotate: true,
    enablePan: false,
    update() {
      camera.lookAt(this.target);
    },
  };

  // Placeholder until head exists — failsafe bbox framing runs after head is built.
  const frameY = faceFrame
    ? faceFrame.aimY
    : fit.isBust && Number.isFinite(eyeY) && eyeY > 0.2
      ? eyeY
      : 1.5;
  controls.target.set(0, frameY, 0);
  camera.near = 0.1;
  camera.far = 100;
  camera.fov = KAREN_CAMERA_FOV;
  // Low camera looking up — dominant interrogation angle.
  camera.position.set(
    0,
    faceFrame ? frameY - KAREN_CAMERA_LOOK_UP : KAREN_PORTRAIT_CAM.position.y,
    faceFrame ? 2.5 : KAREN_PORTRAIT_CAM.position.z,
  );
  camera.lookAt(0, frameY, 0);
  camera.updateProjectionMatrix();

  let raf = 0;
  let running = false;
  let speakUntil = 0;
  let angry = false;
  let baseCamZ = baseZ;

  // Screen layout (rigged figures only): "intro" = big centered face; "game" = head pulled
  // back and raised so it clears the answer dock and the mouth stays visible while talking.
  let stageLayout: "intro" | "game" = "intro";
  const stageDist = (): number => {
    if (!faceFrame) return baseZ;
    return stageLayout === "game"
      ? faceFrame.dist * (KAREN_ACTIVE_PROFILE.gameCamDistanceScale ?? 1)
      : faceFrame.dist;
  };
  const stageAimY = (): number => {
    if (!faceFrame) return eyeY;
    return stageLayout === "game" && typeof KAREN_ACTIVE_PROFILE.gameAimBelowEye === "number"
      ? faceFrame.eyeY - KAREN_ACTIVE_PROFILE.gameAimBelowEye
      : faceFrame.aimY;
  };
  /** Y the camera is easing toward (figures); busts keep the original instant framing. */
  let desiredAimY = faceFrame ? faceFrame.aimY : eyeY;

  // Real lip-sync: TAP the playing audio. Never put the AnalyserNode in the
  // speaker path — a stale analyser→destination link goes fully silent.
  const lipAnalyser = audioCtx.createAnalyser();
  lipAnalyser.fftSize = 512;
  lipAnalyser.smoothingTimeConstant = 0.55;
  const outGain = audioCtx.createGain();
  outGain.gain.value = 1;
  outGain.connect(audioCtx.destination);
  const lipBuf = new Uint8Array(lipAnalyser.fftSize);
  /** Smoothed 0–1 speech amplitude — drives jawOpen OR the head-bob fallback. */
  let lastAmp = 0;
  // Dev diagnostics (stripped from production builds).
  let lineStartedAt = 0;
  let lineMaxAmp = 0;
  let warnedSilent = false;
  let lastAmpLogAt = 0;
  /** Monotonic id so a stale onended/timeout can't cut a newer line short. */
  let speakToken = 0;
  let activeSrc: AudioBufferSourceNode | null = null;

  /** 0–1 speech energy from the AnalyserNode (RMS of the live waveform). */
  const readLipEnergy = (): number => {
    lipAnalyser.getByteTimeDomainData(lipBuf);
    let sumSq = 0;
    for (let i = 0; i < lipBuf.length; i++) {
      const v = (lipBuf[i]! - 128) / 128;
      sumSq += v * v;
    }
    return Math.min(1, Math.sqrt(sumSq / lipBuf.length) * 4.2);
  };
  const hasBlend = blend.ok;
  let detachShout: (() => void) | null = null;
  /**
   * The speaking bus says "she is talking" — but when the voice is the browser's
   * speechSynthesis there is NO audio buffer for the analyser to read. In that case the
   * jaw runs a speech-shaped envelope instead of freezing (approximate, not audio-synced).
   */
  let busTalking = false;
  let detachBus: (() => void) | null = null;
  // RPM / ARKit readiness — map jawOpen + viseme_aa when the swapped GLB has them.
  const lipMap = mapKarenLipMorphTargets(model);

  const head = {
    renderer,
    camera,
    scene,
    audioCtx,
    audioAnalyzerNode: lipAnalyser,
    nodeAvatar: node,
    armature: model,
    morphs,
    controls,
    isRunning: false,
    isSpeaking: false,
    hasBlendshapes: hasBlend,
    lightAmbient,
    lightDirect,
    lightSpot,
    __karenModel: model,
    __karenEyeY: eyeY,
    __karenFaceFrame: faceFrame,
    __karenHasBlendshapes: hasBlend,
    __karenAngry: false,
    __speakUntil: 0,
    /** Live smoothed speech amplitude (0–1) — read by the shout fallback + dev test button. */
    __karenReadAmplitude: () => lastAmp,
    opt: {},
    start(this: TripoHead) {
      running = true;
      this.isRunning = true;
      void audioCtx.resume().catch(() => undefined);
      if (raf) return;
      // No blendshapes → head-bob + chest pulse while dispatchKarenSpeaking(true).
      detachShout = attachKarenShoutFallback(this as unknown as TripoHead);
      detachBus?.();
      detachBus = subscribeKarenSpeaking((s) => {
        busTalking = s;
      });
      const tick = (t: number) => {
        if (!running) return;
        const untilExt =
          typeof (this as TripoHead).__speakUntil === "number"
            ? (this as TripoHead).__speakUntil
            : 0;
        const speaking = performance.now() < Math.max(speakUntil, untilExt);
        (this as TripoHead).isSpeaking = speaking;

        // ONE analyser read per frame → fast attack, slower release = natural mouth.
        // Real audio in the analyser wins; otherwise (browser TTS) fall back to the envelope.
        const synthTalking = busTalking && !speaking && (hasBlend || lipMap.jawOpen);
        const rawAmp = speaking ? readLipEnergy() : synthTalking ? karenProceduralMouthEnergy(t) : 0;
        lastAmp += (rawAmp - lastAmp) * (rawAmp > lastAmp ? 0.55 : 0.25);
        if (lastAmp < 0.01) lastAmp = 0;

        if (KAREN_DEV && speaking) {
          const now = performance.now();
          lineMaxAmp = Math.max(lineMaxAmp, rawAmp);
          if (now - lastAmpLogAt >= 150) {
            lastAmpLogAt = now;
            console.debug(
              `[karen/audio-test] amplitude raw=${rawAmp.toFixed(3)} smoothed=${lastAmp.toFixed(3)} ` +
                `drives=${hasBlend || lipMap.jawOpen ? "jawOpen morph" : "head-bob fallback (no jaw morph)"}`,
            );
          }
          // Audio "plays" but the analyser hears nothing → tell us why.
          if (!warnedSilent && now - lineStartedAt > 1000 && lineMaxAmp < 0.01) {
            warnedSilent = true;
            karenDevWarn(
              "Audio is NOT registering on the analyser (amplitude ≈ 0 for 1s while speaking). " +
                "Check: AudioContext state, clip leading silence, or a muted/zero-gain source.",
              { ctxState: audioCtx.state, lineMaxAmp },
            );
          }
        }

        if (hasBlend) {
          const brow = angry ? 1 : KAREN_AGGRESSIVE_BROW;
          setMorphWeight(model, "browDownLeft", brow);
          setMorphWeight(model, "browDownRight", brow);
        }

        if (hasBlend || lipMap.jawOpen) {
          // Drive jaw + mouthOpen + viseme_aa together — Avaturn Head_Mesh needs
          // visible amplitude or the lips look frozen on quiet Kokoro clips.
          const jaw = Math.min(1, lastAmp * 1.45);
          setMorphWeight(model, "jawOpen", jaw);
          setMorphWeight(model, "mouthOpen", jaw * 0.9);
          if (lipMap.viseme_aa) setMorphWeight(model, "viseme_aa", jaw * 0.85);
          if (!speaking && lastAmp < 0.02) {
            setMorphWeight(model, "jawOpen", 0);
            setMorphWeight(model, "mouthOpen", 0);
            if (lipMap.viseme_aa) setMorphWeight(model, "viseme_aa", 0);
          }
        } else if (!speaking && !(this as TripoHead).__karenFacingAway) {
          // Shout fallback owns x while speaking; settle yaw when idle.
          // Mute Protocol facing-away must not be lerped back to camera.
          model.rotation.y = THREE.MathUtils.lerp(
            model.rotation.y,
            MODEL_YAW,
            0.08,
          );
        }

        // Angry camera push-in (mild — keep bust inside the frame).
        const wantZ = angry ? baseCamZ * 0.88 : baseCamZ;
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, wantZ, 0.08);
        if (faceFrame) {
          // Ease the vertical aim so intro ↔ game layout glides instead of snapping.
          // Camera stays below the aim so we keep looking slightly up at her.
          const ny = THREE.MathUtils.lerp(controls.target.y, desiredAimY, 0.08);
          controls.target.y = ny;
          camera.position.y = ny - KAREN_CAMERA_LOOK_UP;
        }
        camera.lookAt(controls.target);

        this.render();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
    stop(this: TripoHead) {
      running = false;
      detachShout?.();
      detachShout = null;
      detachBus?.();
      detachBus = null;
      busTalking = false;
      this.isRunning = false;
      this.isSpeaking = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      // Battery save — suspend Web Audio when the loop stops.
      if (audioCtx.state === "running") {
        void audioCtx.suspend().catch(() => undefined);
      }
    },
    render(this: TripoHead) {
      if (!this.isRunning) return;
      renderer.render(scene, camera);
    },
    onResize() {
      const w = Math.max(1, node.clientWidth || window.innerWidth);
      const h = Math.max(1, node.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      camera.fov = KAREN_CAMERA_FOV;
      camera.near = KAREN_CAMERA_NEAR;
      camera.far = KAREN_CAMERA_FAR;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(karenClampedPixelRatio(window.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
    },
    setView(_view?: string, opt?: Record<string, number>) {
      const panX = typeof opt?.cameraX === "number" ? (opt.cameraX + 0.12) * 0.9 : 0;
      const zDelta =
        typeof opt?.cameraDistance === "number"
          ? (opt.cameraDistance + 0.8) * -0.55
          : 0;
      baseCamZ = (faceFrame ? stageDist() : baseZ) + zDelta;
      const z = angry ? baseCamZ * 0.88 : baseCamZ;
      camera.fov = KAREN_CAMERA_FOV;
      camera.near = KAREN_CAMERA_NEAR;
      camera.far = KAREN_CAMERA_FAR;
      if (faceFrame) {
        // Figure: keep the current Y (the render loop eases it toward the stage's aim).
        desiredAimY = stageAimY();
        camera.position.set(panX, controls.target.y - KAREN_CAMERA_LOOK_UP, z);
      } else {
        const lookY =
          eyeY > 0.9 && eyeY < 2.1 ? eyeY : KAREN_PORTRAIT_CAM.lookAt.y;
        camera.position.set(panX, lookY - KAREN_CAMERA_LOOK_UP, z);
        controls.target.set(0, lookY, 0);
      }
      camera.lookAt(controls.target);
      camera.updateProjectionMatrix();
    },
    /** Intro / result = big centered face; game = head raised above the answer dock. */
    setStageLayout(layout: "intro" | "game") {
      if (!faceFrame || layout === stageLayout) return;
      stageLayout = layout;
      baseCamZ = stageDist();
      desiredAimY = stageAimY();
      resetKarenSpeakRest(); // speak push-in must re-capture its rest distance
      karenDevLog("Stage layout", { layout, dist: Number(baseCamZ.toFixed(2)), aimY: Number(desiredAimY.toFixed(3)) });
    },
    setMood(mood: string) {
      applyKarenMoodLighting(this as unknown as TalkingHead, mood);
      const m = (mood || "").toLowerCase();
      angry = m === "angry" || m === "furious";
      (this as TripoHead).__karenAngry = angry;

      if (hasBlend) {
        const brow = angry ? 1 : KAREN_AGGRESSIVE_BROW;
        setMorphWeight(model, "browDownLeft", brow);
        setMorphWeight(model, "browDownRight", brow);
        if (angry) {
          setMorphWeight(model, "mouthSmileLeft", 0);
        } else if (m === "happy") {
          setMorphWeight(model, "mouthSmileLeft", 0.75);
        } else {
          setMorphWeight(model, "mouthSmileLeft", 0.35);
        }
      } else if (angry) {
        // Forward head tilt when morphs are gone.
        model.rotation.x = Math.max(model.rotation.x, 0.12);
      }
    },
    lookAt(clientX: number, clientY: number) {
      if ((this as TripoHead).__karenFacingAway) return;
      const nx = (clientX / window.innerWidth) * 2 - 1;
      const ny = -((clientY / window.innerHeight) * 2 - 1);
      model.rotation.y = THREE.MathUtils.lerp(
        model.rotation.y,
        MODEL_YAW + nx * 0.22,
        0.08,
      );
      if (hasBlend || performance.now() >= speakUntil) {
        const restX = angry ? 0.12 : 0;
        const hitUntil = (this as TripoHead).__karenHitUntil ?? 0;
        if (performance.now() < hitUntil) return;
        model.rotation.x = THREE.MathUtils.lerp(
          model.rotation.x,
          restX + ny * 0.08,
          0.08,
        );
      }
    },
    setBaselineValue(mt: string, val: number | null) {
      if (!hasBlend) return;
      let v = val ?? 0;
      if (mt === "browDownLeft" || mt === "browDownRight") {
        v = Math.max(KAREN_AGGRESSIVE_BROW, v);
      }
      setMorphWeight(model, mt, v);
    },
    setFixedValue(mt: string, val: number | null) {
      if (!hasBlend) return;
      let v = val ?? 0;
      if (mt === "browDownLeft" || mt === "browDownRight") {
        v = Math.max(KAREN_AGGRESSIVE_BROW, v);
      }
      setMorphWeight(model, mt, v);
    },
    speakAudio(this: TripoHead, payload?: { audio?: AudioBuffer }) {
      const incoming = payload?.audio;
      if (!incoming || typeof incoming.getChannelData !== "function") {
        console.warn("[tripo-avatar] speakAudio missing AudioBuffer", payload);
        return;
      }
      const ctx = this.audioCtx && this.audioCtx.state !== "closed" ? this.audioCtx : audioCtx;
      void ctx.resume().catch(() => undefined);
      try {
        // Cut any line still playing so two roasts never talk over each other.
        if (activeSrc) {
          activeSrc.onended = null;
          try {
            activeSrc.stop();
          } catch {
            /* already ended */
          }
          try {
            activeSrc.disconnect();
          } catch {
            /* already disconnected */
          }
          activeSrc = null;
        }
        const token = ++speakToken;
        const src = ctx.createBufferSource();
        // Same-context buffers play as-is. Only copy when the PCM came from another clock.
        let local = incoming;
        if (incoming.sampleRate !== ctx.sampleRate) {
          local = ctx.createBuffer(
            incoming.numberOfChannels,
            incoming.length,
            incoming.sampleRate,
          );
          for (let c = 0; c < incoming.numberOfChannels; c++) {
            local.copyToChannel(incoming.getChannelData(c), c);
          }
        }
        src.buffer = local;
        // Speakers get a direct GainNode. Analyser is a side tap so a dead
        // analyser can never mute the roast.
        src.connect(outGain);
        src.connect(lipAnalyser);
        activeSrc = src;
        this.start();
        const durMs = Math.max(200, local.duration * 1000);
        speakUntil = performance.now() + durMs;
        this.__speakUntil = speakUntil;
        this.isSpeaking = true;
        lineStartedAt = performance.now();
        lineMaxAmp = 0;
        warnedSilent = false;
        const canMoveJaw = hasBlend || lipMap.jawOpen;
        karenDevLog("Amplitude Analyzer Running", {
          wiring: "BufferSource → GainNode → destination (analyser tap)",
          readsWith: "getByteTimeDomainData (waveform RMS)",
          fftSize: lipAnalyser.fftSize,
          ctxState: ctx.state,
          seconds: Number(local.duration.toFixed(2)),
          drives: canMoveJaw ? "jawOpen morph target" : "head-bob fallback",
        });
        if (!canMoveJaw) {
          karenDevWarn(
            "This GLB has no jawOpen / viseme morph targets — the mouth mesh cannot open. " +
              "Live audio amplitude drives Head-bone talk motion instead. " +
              "For real lips, activate avaturn_model-v3.glb (ARKit Head_Mesh) in avatar-assets.",
          );
        }
        // Triggers shout fallback (no morphs) or real jaw via speakAudio bus.
        dispatchKarenSpeaking(true);
        const finish = () => {
          if (token !== speakToken) return; // a newer line owns the state now
          this.isSpeaking = false;
          if (activeSrc === src) activeSrc = null;
          dispatchKarenSpeaking(false);
        };
        src.onended = finish;
        // Never start(0) — t=0 is in the past once the context has been running.
        src.start(ctx.currentTime);
        window.setTimeout(finish, durMs + 80);
      } catch (err) {
        console.warn("[tripo-avatar] speakAudio failed", err);
      }
    },
  } as unknown as TripoHead;

  applyKarenCinematicLighting(head as unknown as TalkingHead);
  applyKarenStudioBackground(head as unknown as TalkingHead);
  applyKarenMoodLighting(head as unknown as TalkingHead, opts.mood);
  // Re-assert color pipeline after lighting hooks.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = KAREN_TONE_EXPOSURE;

  // TEMP: skip DOF while diagnosing invisible avatar.

  // Canvas size AFTER model load — never leave a 0×0 buffer.
  forceKarenRendererFullscreen(head as unknown as TalkingHead);
  // Failsafe: camera looks at exact bbox center of the model.
  applyKarenPortraitCamera(head as unknown as TalkingHead);
  logKarenAvatarVisibility(head as unknown as TalkingHead);
  attachKarenAvatarDebug(head as unknown as TalkingHead);
  exposeKarenDebugConsole(head as unknown as TalkingHead);

  try {
    head.setMood(mapChatMoodToTalkingHead(opts.mood));
  } catch {
    /* ignore */
  }

  head.start();
  opts.onProgress?.(100);

  return head as unknown as TalkingHead;
}
