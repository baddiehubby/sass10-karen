"use client";

/**
 * WebGL cinematic orb — loaded only when resolveOrbRenderMode() === "webgl".
 * Never import this from login/landing entry paths statically.
 */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Sphere } from "@react-three/drei";
import * as THREE from "three";
import { TIME_THEME_COLORS, type TimeTheme } from "@/lib/time-theme";

type OrbSceneProps = {
  theme: TimeTheme;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
  breathing: boolean;
  scrollPulse: number;
  size?: number;
  /** Cap animation cost on mid-tier GPUs. */
  lowDetail?: boolean;
};

function LivingOrbMesh({
  theme,
  mouse,
  breathing,
  scrollPulse,
  size = 1.35,
  lowDetail = false,
}: OrbSceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const colors = TIME_THEME_COLORS[theme];
  const targetRot = useRef({ x: 0, y: 0 });
  const breathPhase = useRef(Math.random() * Math.PI * 2);
  const wobble = useRef({ x: 0, y: 0, s: 1 });
  const frameSkip = useRef(0);

  useFrame((state, delta) => {
    // Throttle: skip every other frame when not breathing for smoother battery life
    if (lowDetail && !breathing) {
      frameSkip.current = (frameSkip.current + 1) % 2;
      if (frameSkip.current !== 0) return;
    }

    const g = groupRef.current;
    if (!g) return;

    targetRot.current.x = THREE.MathUtils.lerp(targetRot.current.x, mouse.current.y * 0.35, delta * 2.2);
    targetRot.current.y = THREE.MathUtils.lerp(targetRot.current.y, mouse.current.x * 0.45, delta * 2.2);
    g.rotation.x = targetRot.current.x;
    g.rotation.y = targetRot.current.y + state.clock.elapsedTime * 0.08;

    breathPhase.current += delta * (breathing ? 0.55 : 0.9);
    const breath = breathing ? 1 + Math.sin(breathPhase.current) * 0.045 : 1 + Math.sin(breathPhase.current) * 0.02;
    const pulse = 1 + scrollPulse * 0.06;
    wobble.current.s = THREE.MathUtils.lerp(wobble.current.s, breath * pulse, delta * 3);
    // Avoid Math.random every frame — deterministic micro-wobble
    const t = state.clock.elapsedTime;
    wobble.current.x = THREE.MathUtils.lerp(wobble.current.x, Math.sin(t * 0.7) * 0.008, delta * 0.8);
    wobble.current.y = THREE.MathUtils.lerp(wobble.current.y, Math.cos(t * 0.55) * 0.008, delta * 0.8);

    g.scale.setScalar(wobble.current.s);
    g.position.x = wobble.current.x;
    g.position.y = wobble.current.y;

    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.15;
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
    }
  });

  const sphereSeg = lowDetail ? 48 : 64;
  const torusSeg = lowDetail ? 64 : 96;

  return (
    <group ref={groupRef}>
      <Sphere args={[size, sphereSeg, sphereSeg]}>
        <MeshDistortMaterial
          color={colors.primary}
          attach="material"
          distort={lowDetail ? 0.16 : 0.22}
          speed={breathing ? 1.0 : 1.4}
          roughness={0.08}
          metalness={0.85}
          emissive={colors.emissive}
          emissiveIntensity={breathing ? 0.35 : 0.5}
          clearcoat={1}
          clearcoatRoughness={0.08}
        />
      </Sphere>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[size + 0.35, 0.025, 12, torusSeg]} />
        <meshStandardMaterial
          color={colors.secondary}
          emissive={colors.secondary}
          emissiveIntensity={2.5}
          transparent
          opacity={0.55}
        />
      </mesh>
    </group>
  );
}

export type CinematicOrbWebGlProps = {
  className?: string;
  theme: TimeTheme;
  breathing?: boolean;
  scrollPulse?: number;
  mouseRef?: React.MutableRefObject<{ x: number; y: number }>;
  height?: string;
  shimmer?: boolean;
  /** Fired once the WebGL layer can safely replace the CSS orb. */
  onReady?: () => void;
  onFailed?: () => void;
};

export function CinematicOrbWebGl({
  className = "",
  theme,
  breathing = false,
  scrollPulse = 0,
  mouseRef,
  height = "min(68vh, 520px)",
  shimmer = false,
  onReady,
  onFailed,
}: CinematicOrbWebGlProps) {
  const internalMouse = useRef({ x: 0, y: 0 });
  const mouse = mouseRef ?? internalMouse;
  const colors = TIME_THEME_COLORS[theme];
  const dpr = useMemo(() => {
    if (typeof window === "undefined") return 1;
    return Math.min(window.devicePixelRatio || 1, 1.75);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const id = window.requestAnimationFrame(() => {
      if (!cancelled) onReady?.();
    });
    const onLost = () => onFailed?.();
    window.addEventListener("webglcontextlost", onLost);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id);
      window.removeEventListener("webglcontextlost", onLost);
    };
  }, [onReady, onFailed]);

  return (
    <div
      className={`relative mx-auto w-full max-w-[min(92vw,520px)] ${className}`}
      style={{ height }}
    >
      <div
        className="pointer-events-none absolute inset-[-15%] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)` }}
      />
      {shimmer ? <div className="orb-gold-shimmer pointer-events-none absolute inset-0 rounded-full" aria-hidden /> : null}
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 38 }}
        dpr={dpr}
        gl={{ alpha: true, antialias: dpr < 1.5, powerPreference: "low-power" }}
        frameloop="always"
      >
        <ambientLight intensity={0.25} />
        <pointLight position={[8, 8, 8]} intensity={1.1} color={colors.primary} />
        <pointLight position={[-6, -4, -6]} intensity={0.45} color={colors.secondary} />
        <Suspense fallback={null}>
          <LivingOrbMesh
            theme={theme}
            mouse={mouse}
            breathing={breathing}
            scrollPulse={scrollPulse}
            lowDetail
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
