"use client";

import { Component, Suspense, useEffect, useMemo, useRef, type ErrorInfo, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  getBlendshapes,
  type KarenExpressionMood,
} from "@/src/lib/karen/expression-bridge";

const MODEL_URL = "/models/karen.glb";

export type Karen3DMood = string | null | undefined;

type Karen3DProps = {
  mood?: Karen3DMood;
  isSpeaking?: boolean;
  className?: string;
};

/** Map chat emotion tags → expression-bridge moods. */
export function mapChatMoodToExpression(mood: Karen3DMood): KarenExpressionMood {
  const key = (mood ?? "ANNOYED").toUpperCase();
  switch (key) {
    case "SARCASTIC":
      return "SARCASTIC";
    case "PROUD":
    case "SWEET":
      return key === "PROUD" ? "PROUD" : "SWEET";
    case "FURIOUS":
    case "ANGRY":
      return "FURIOUS";
    case "ANNOYED":
      return "ANNOYED";
    default:
      return "ANNOYED";
  }
}

function applyBlendshapes(root: THREE.Object3D, shapes: Record<string, number>) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const dict = obj.morphTargetDictionary;
    const influences = obj.morphTargetInfluences;
    if (!dict || !influences) return;

    for (const [name, value] of Object.entries(shapes)) {
      const idx = dict[name];
      if (typeof idx === "number" && idx >= 0 && idx < influences.length) {
        influences[idx] = value;
      }
    }

    // Case-insensitive fallback for slightly different ARKit naming.
    for (const [morphName, idx] of Object.entries(dict)) {
      const lower = morphName.toLowerCase();
      for (const [name, value] of Object.entries(shapes)) {
        if (lower === name.toLowerCase() && typeof idx === "number") {
          influences[idx] = value;
        }
      }
    }
  });
}

function KarenAvatarModel({
  mood,
  isSpeaking,
}: {
  mood: Karen3DMood;
  isSpeaking: boolean;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const root = useMemo(() => scene.clone(true), [scene]);
  const expressionMood = mapChatMoodToExpression(mood);

  useFrame(() => {
    const shapes = getBlendshapes(expressionMood, isSpeaking);
    applyBlendshapes(root, shapes);
  });

  useEffect(() => {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.frustumCulled = false;
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });
  }, [root]);

  return (
    <Center>
      <primitive object={root} scale={1.15} />
    </Center>
  );
}

function FallbackOrb({ mood }: { mood: Karen3DMood }) {
  const mesh = useRef<THREE.Mesh>(null);
  const color = useMemo(() => {
    const key = (mood ?? "ANNOYED").toUpperCase();
    if (key === "SARCASTIC") return "#ec4899";
    if (key === "SWEET" || key === "PROUD") return "#3b82f6";
    if (key === "ANGRY" || key === "FURIOUS") return "#ef4444";
    return "#f97316";
  }, [mood]);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.y += delta * 0.35;
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.85, 32, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.35} />
    </mesh>
  );
}

class ModelErrorBoundary extends Component<
  { mood: Karen3DMood; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[Karen3D] GLB load failed — using fallback orb", error.message, info.componentStack);
  }

  render() {
    if (this.state.failed) return <FallbackOrb mood={this.props.mood} />;
    return this.props.children;
  }
}

/**
 * Karen 3D face — loads `/models/karen.glb` and drives ARKit morph targets
 * from `getBlendshapes(mood, isSpeaking)`.
 */
export function Karen3D({ mood, isSpeaking = false, className = "" }: Karen3DProps) {
  return (
    <div className={`relative mx-auto h-44 w-full max-w-sm sm:h-56 ${className}`}>
      <div className="absolute inset-0 rounded-full bg-rose-500/10 blur-3xl" aria-hidden />
      <Canvas
        camera={{ position: [0, 0.05, 1.55], fov: 35 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        className="h-full w-full touch-none"
      >
        <color attach="background" args={["#00000000"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[2.5, 3, 2]} intensity={1.15} />
        <directionalLight position={[-2, 1, -1]} intensity={0.35} color="#fb7185" />
        <Suspense fallback={<FallbackOrb mood={mood} />}>
          <ModelErrorBoundary mood={mood}>
            <KarenAvatarModel mood={mood} isSpeaking={isSpeaking} />
          </ModelErrorBoundary>
        </Suspense>
        <Environment preset="city" />
      </Canvas>
      <p className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[10px] font-semibold tracking-[0.25em] text-white/60">
        {(mood ?? "ANNOYED").toString().toUpperCase()}
        {isSpeaking ? " · SPEAKING" : ""}
      </p>
    </div>
  );
}

// Preload when the browser is idle (client only).
if (typeof window !== "undefined") {
  try {
    useGLTF.preload(MODEL_URL);
  } catch {
    /* model may be absent until asset is added */
  }
}
