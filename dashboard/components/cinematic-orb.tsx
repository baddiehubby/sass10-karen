"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, MeshDistortMaterial, Sphere } from "@react-three/drei";
import * as THREE from "three";

export type TimeTheme = "morning" | "afternoon" | "night";

export function getTimeTheme(hour = new Date().getHours()): TimeTheme {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "night";
}

export const TIME_THEME_COLORS: Record<
  TimeTheme,
  { primary: string; secondary: string; emissive: string; glow: string }
> = {
  morning: { primary: "#22d3ee", secondary: "#0ea5e9", emissive: "#06b6d4", glow: "rgba(34,211,238,0.18)" },
  afternoon: { primary: "#f59e0b", secondary: "#fbbf24", emissive: "#d97706", glow: "rgba(245,158,11,0.16)" },
  night: { primary: "#818cf8", secondary: "#a855f7", emissive: "#6366f1", glow: "rgba(129,140,248,0.2)" },
};

type OrbSceneProps = {
  theme: TimeTheme;
  mouse: React.MutableRefObject<{ x: number; y: number }>;
  breathing: boolean;
  scrollPulse: number;
  size?: number;
};

function LivingOrbMesh({ theme, mouse, breathing, scrollPulse, size = 1.35 }: OrbSceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const colors = TIME_THEME_COLORS[theme];
  const targetRot = useRef({ x: 0, y: 0 });
  const breathPhase = useRef(Math.random() * Math.PI * 2);
  const wobble = useRef({ x: 0, y: 0, s: 1 });

  useFrame((state, delta) => {
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
    wobble.current.x = THREE.MathUtils.lerp(wobble.current.x, (Math.random() - 0.5) * 0.012, delta * 0.8);
    wobble.current.y = THREE.MathUtils.lerp(wobble.current.y, (Math.random() - 0.5) * 0.012, delta * 0.8);

    g.scale.setScalar(wobble.current.s);
    g.position.x = wobble.current.x;
    g.position.y = wobble.current.y;

    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.15;
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      <Sphere args={[size, 72, 72]}>
        <MeshDistortMaterial
          color={colors.primary}
          attach="material"
          distort={0.22}
          speed={breathing ? 1.2 : 1.8}
          roughness={0.08}
          metalness={0.85}
          emissive={colors.emissive}
          emissiveIntensity={breathing ? 0.35 : 0.5}
          clearcoat={1}
          clearcoatRoughness={0.08}
        />
      </Sphere>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[size + 0.35, 0.025, 16, 120]} />
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

type CinematicOrbProps = {
  className?: string;
  theme?: TimeTheme;
  breathing?: boolean;
  scrollPulse?: number;
  mouseRef?: React.MutableRefObject<{ x: number; y: number }>;
  height?: string;
  shimmer?: boolean;
};

export function CinematicOrb({
  className = "",
  theme: themeProp,
  breathing = false,
  scrollPulse = 0,
  mouseRef,
  height = "min(68vh, 520px)",
  shimmer = false,
}: CinematicOrbProps) {
  const theme = themeProp ?? getTimeTheme();
  const internalMouse = useRef({ x: 0, y: 0 });
  const mouse = mouseRef ?? internalMouse;
  const colors = TIME_THEME_COLORS[theme];

  const dpr = useMemo(() => (typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1), []);

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
      <Canvas camera={{ position: [0, 0, 5.2], fov: 38 }} dpr={dpr} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.25} />
        <pointLight position={[8, 8, 8]} intensity={1.1} color={colors.primary} />
        <pointLight position={[-6, -4, -6]} intensity={0.45} color={colors.secondary} />
        <Suspense fallback={null}>
          <LivingOrbMesh theme={theme} mouse={mouse} breathing={breathing} scrollPulse={scrollPulse} />
          <Environment preset="night" />
        </Suspense>
      </Canvas>
    </div>
  );
}
