"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Float, MeshDistortMaterial, Sphere } from "@react-three/drei";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import * as THREE from "three";

// ==================== GLOBAL PARTICLE NETWORK BACKGROUND ====================
function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particleCount = Math.min(80, Math.floor(window.innerWidth / 15));
    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; color: string }> = [];
    const colors = ["#4c1d95", "#7c3aed", "#06b6d4"];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)]!,
      });
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      if (!ctx || !canvas) return;

      if (document.hidden) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const mouse = mouseRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < 150) {
          const force = (150 - dist) / 150;
          p.vx -= (dx / dist) * force * 0.02;
          p.vy -= (dy / dist) * force * 0.02;
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        particles.slice(i + 1).forEach((p2) => {
          const ddx = p.x - p2.x;
          const ddy = p.y - p2.y;
          const distance = Math.sqrt(ddx * ddx + ddy * ddy);
          if (distance < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(124, 58, 237, ${0.15 * (1 - distance / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ background: "transparent" }}
      aria-hidden
    />
  );
}

// ==================== AMBIENT GLOW ORBS ====================
function AmbientOrbs() {
  return (
    <>
      <div
        className="animate-float-1 fixed h-[600px] w-[600px] rounded-full opacity-30 mix-blend-screen blur-[120px]"
        style={{
          background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)",
          top: "-200px",
          right: "-100px",
          animationDelay: "0s",
        }}
        aria-hidden
      />
      <div
        className="animate-float-2 fixed h-[500px] w-[500px] rounded-full opacity-25 mix-blend-screen blur-[100px]"
        style={{
          background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
          bottom: "-150px",
          left: "-50px",
          animationDelay: "-5s",
        }}
        aria-hidden
      />
      <div
        className="animate-float-3 fixed h-[400px] w-[400px] rounded-full opacity-20 mix-blend-screen blur-[90px]"
        style={{
          background: "radial-gradient(circle, #ec4899 0%, transparent 70%)",
          top: "40%",
          right: "10%",
          animationDelay: "-10s",
        }}
        aria-hidden
      />
    </>
  );
}

// ==================== 3D INTERACTIVE BUDDY ORB ====================
type Mood = "neutral" | "happy" | "excited" | "concerned" | "thinking" | "sleepy";

function BuddyOrb3D() {
  const [mood, setMood] = useState<Mood>("neutral");
  const sphereRef = useRef<THREE.Mesh>(null);

  const moodColors: Record<Mood, string> = {
    neutral: "#7c3aed",
    happy: "#06b6d4",
    excited: "#f59e0b",
    concerned: "#ef4444",
    thinking: "#8b5cf6",
    sleepy: "#64748b",
  };

  useEffect(() => {
    const moods: Mood[] = ["neutral", "happy", "excited", "concerned", "thinking", "sleepy"];
    const interval = window.setInterval(() => {
      setMood((prev) => {
        const idx = moods.indexOf(prev);
        return moods[(idx + 1) % moods.length]!;
      });
    }, 3500);
    return () => window.clearInterval(interval);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!sphereRef.current) return;
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = (clientX / innerWidth - 0.5) * 0.3;
    const y = -(clientY / innerHeight - 0.5) * 0.3;
    sphereRef.current.rotation.x = THREE.MathUtils.lerp(sphereRef.current.rotation.x, y, 0.1);
    sphereRef.current.rotation.y = THREE.MathUtils.lerp(sphereRef.current.rotation.y, x, 0.1);
  }, []);

  return (
    <div
      className="relative mx-auto mb-8 h-64 w-64 cursor-grab active:cursor-grabbing"
      onMouseMove={handleMouseMove}
      style={{ perspective: "1000px" }}
    >
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} className="!bg-transparent" dpr={[1, 2]}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} color={moodColors[mood]} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#06b6d4" />

        <Suspense fallback={null}>
          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            <Sphere ref={sphereRef} args={[1.2, 64, 64]}>
              <MeshDistortMaterial
                color={moodColors[mood]}
                attach="material"
                distort={0.3}
                speed={2}
                roughness={0.2}
                metalness={0.8}
                emissive={moodColors[mood]}
                emissiveIntensity={0.3}
              />
            </Sphere>
          </Float>

          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.5, 0.02, 16, 100]} />
            <meshStandardMaterial
              color={moodColors[mood]}
              emissive={moodColors[mood]}
              emissiveIntensity={2}
              transparent
              opacity={0.6}
            />
          </mesh>

          <Environment preset="city" />
          <ContactShadows opacity={0.4} scale={10} blur={2} far={10} />
        </Suspense>
      </Canvas>

      <motion.div
        className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          <span className="text-sm font-medium text-cyan-300/90">
            {mood === "neutral" && "I'm listening…"}
            {mood === "happy" && "Detecting joy… ✨"}
            {mood === "excited" && "Feeling excited! 🚀"}
            {mood === "concerned" && "Noticing concern… 💙"}
            {mood === "thinking" && "Processing thoughts… 🤔"}
            {mood === "sleepy" && "Taking a breath… 😴"}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function BuddyOrbFallback() {
  const [mood, setMood] = useState<Mood>("neutral");

  const moodColors: Record<Mood, string> = {
    neutral: "from-violet-600 to-purple-700",
    happy: "from-cyan-400 to-blue-500",
    excited: "from-amber-400 to-orange-500",
    concerned: "from-red-400 to-rose-500",
    thinking: "from-indigo-500 to-violet-600",
    sleepy: "from-slate-500 to-slate-600",
  };

  useEffect(() => {
    const moods: Mood[] = ["neutral", "happy", "excited", "concerned", "thinking", "sleepy"];
    const interval = window.setInterval(() => {
      setMood((prev) => {
        const idx = moods.indexOf(prev);
        return moods[(idx + 1) % moods.length]!;
      });
    }, 3500);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="relative mx-auto mb-8 h-48 w-48">
      <div
        className={`flex h-full w-full animate-pulse-slow items-center justify-center rounded-full bg-gradient-to-br ${moodColors[mood]} shadow-[0_0_40px_rgba(124,58,237,0.5)]`}
      >
        <div className="h-3/4 w-3/4 rounded-full border border-white/10 bg-black/20 backdrop-blur-sm" />
      </div>
      <div className="animate-ping-slow absolute inset-0 rounded-full border-2 border-cyan-400/30" />
      <div className="absolute inset-4 rounded-full border border-purple-400/20 animate-pulse" />

      <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          <span className="text-sm font-medium text-cyan-300/90">
            {mood === "neutral" && "I'm listening…"}
            {mood === "happy" && "Detecting joy… ✨"}
            {mood === "excited" && "Feeling excited! 🚀"}
            {mood === "concerned" && "Noticing concern… 💙"}
            {mood === "thinking" && "Processing thoughts… 🤔"}
            {mood === "sleepy" && "Taking a breath… 😴"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ==================== SCROLL REVEAL ====================
function RevealOnScroll({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ==================== GLASS CARD ====================
function GlassCard({ children, className = "", hover = true }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <motion.div
      className={`group relative overflow-hidden rounded-2xl border border-violet-500/20 bg-slate-900/60 p-6 backdrop-blur-xl transition-all duration-300 ${hover ? "hover:border-violet-400/50 hover:shadow-[0_0_30px_rgba(124,58,237,0.3)]" : ""} ${className}`}
      whileHover={hover ? { y: -8, transition: { duration: 0.2 } } : {}}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="glass-scan-line absolute -top-px h-px w-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      </div>
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

// ==================== ANIMATED ICONS ====================
function AnimatedIcon({ type }: { type: "shield" | "eye" | "heart" | "brain" }) {
  const icons: Record<string, React.ReactElement> = {
    shield: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
        <animate attributeName="stroke-dasharray" values="0,100;100,0;0,100" dur="2s" repeatCount="indefinite" />
      </svg>
    ),
    eye: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-purple-400" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <animate attributeName="opacity" values="1;0.7;1" dur="1.5s" repeatCount="indefinite" />
      </svg>
    ),
    heart: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-rose-400" fill="currentColor">
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        <animateTransform attributeName="transform" type="scale" values="1;1.1;1" dur="1s" repeatCount="indefinite" />
      </svg>
    ),
    brain: (
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
        />
        <animate attributeName="stroke-dashoffset" values="100;0" dur="2s" repeatCount="indefinite" />
      </svg>
    ),
  };

  return icons[type] ?? null;
}

// ==================== MAIN ====================
export default function BuddyAIHomepage() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -50]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768 || /Mobi/i.test(navigator.userAgent));
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [carouselIndex, setCarouselIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToCard = (i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setCarouselIndex(i);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const scrollLeft = el.scrollLeft;
      const w = el.clientWidth || 1;
      const i = Math.round(scrollLeft / (w * 0.85));
      setCarouselIndex(Math.min(2, Math.max(0, i)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <style jsx global>{`
        @keyframes float-1 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -20px) scale(1.05);
          }
          66% {
            transform: translate(-15px, 10px) scale(0.95);
          }
        }
        @keyframes float-2 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(-25px, 15px) scale(0.98);
          }
          66% {
            transform: translate(20px, -25px) scale(1.02);
          }
        }
        @keyframes float-3 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(15px, 25px) scale(1.03);
          }
          66% {
            transform: translate(-30px, -10px) scale(0.97);
          }
        }
        @keyframes pulse-slow {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.85;
          }
        }
        @keyframes ping-slow {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          70% {
            transform: scale(1.2);
            opacity: 0;
          }
          100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }
        .animate-float-1 {
          animation: float-1 18s ease-in-out infinite;
        }
        .animate-float-2 {
          animation: float-2 22s ease-in-out infinite;
        }
        .animate-float-3 {
          animation: float-3 25s ease-in-out infinite;
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        .animate-ping-slow {
          animation: ping-slow 3s ease-in-out infinite;
        }
        @keyframes neon-border {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .neon-border {
          background: linear-gradient(90deg, #4c1d95, #7c3aed, #06b6d4, #7c3aed, #4c1d95);
          background-size: 300% 300%;
          animation: neon-border 4s ease infinite;
        }
        .gradient-text {
          background: linear-gradient(135deg, #06b6d4, #7c3aed, #4c1d95);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 30px rgba(124, 58, 237, 0.3);
        }
        @keyframes blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
        .cursor-blink::after {
          content: "_";
          animation: blink 1s step-end infinite;
          color: #06b6d4;
          margin-left: 2px;
        }
        @keyframes glass-scan {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateY(420px);
            opacity: 0;
          }
        }
        .group:hover .glass-scan-line {
          animation: glass-scan 1.6s ease-in-out infinite;
        }
      `}</style>

      <ParticleNetwork />
      <AmbientOrbs />

      <motion.div className="relative z-10 min-h-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
        <motion.section
          className="relative flex min-h-screen items-center justify-center px-4 pb-16 pt-20"
          style={{ y: heroY }}
        >
          <div className="mx-auto max-w-5xl text-center">
            {isMobile ? <BuddyOrbFallback /> : <BuddyOrb3D />}

            <motion.h1
              className="mb-6 text-4xl font-bold leading-tight md:text-6xl lg:text-7xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <span className="gradient-text">Buddy AI</span>
              <br />
              <span className="text-white/90">Your Emotional Intelligence Companion</span>
              <span className="cursor-blink" />
            </motion.h1>

            <motion.p
              className="mx-auto mb-10 max-w-3xl text-lg leading-relaxed text-slate-300/90 md:text-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              style={{ textShadow: "0 0 20px rgba(124, 58, 237, 0.2)" }}
            >
              The first AI that understands not just what you say, but how you feel. Compliant, empathetic, and always learning.
            </motion.p>

            <motion.div
              className="mb-16 flex flex-col justify-center gap-4 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              <Link href="/register" className="inline-flex">
                <motion.span
                  className="group relative inline-flex cursor-pointer overflow-hidden rounded-full px-8 py-4 font-semibold text-white"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="neon-border absolute inset-0 rounded-full opacity-70" />
                  <span className="absolute inset-[2px] rounded-full bg-slate-900" />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Get Compliant Now – Free
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </motion.span>
              </Link>

              <Link href="/demo">
                <motion.span
                  className="inline-flex cursor-pointer rounded-full border border-slate-600/50 bg-slate-800/40 px-8 py-4 font-semibold text-white/90 backdrop-blur-sm transition-all duration-300 hover:border-violet-400/50 hover:bg-slate-800/60"
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                >
                  See It in Action
                </motion.span>
              </Link>
            </motion.div>

            <motion.div
              className="flex flex-wrap justify-center gap-6 text-sm text-slate-400/80"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                <span>EU AI Act Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
                <span>End-to-End Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
                <span>Emotion-Aware AI</span>
              </div>
            </motion.div>
          </div>

          <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2" animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <div className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-slate-500/50 p-1">
              <div className="h-3 w-1.5 animate-bounce rounded-full bg-cyan-400/80" />
            </div>
          </motion.div>
        </motion.section>

        <RevealOnScroll>
          <section className="px-4 py-20">
            <div className="mx-auto max-w-6xl">
              <div className="mb-16 text-center">
                <h2 className="gradient-text mb-4 text-3xl font-bold md:text-4xl">Why AI Chat Needs Emotional Intelligence</h2>
                <p className="mx-auto max-w-2xl text-slate-300/90">Standard AI responds to words. Buddy AI responds to people.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {[
                  {
                    icon: "heart" as const,
                    title: "Empathetic Responses",
                    desc: "Buddy detects emotional cues in your language and adapts tone, pacing, and support level in real-time.",
                  },
                  {
                    icon: "shield" as const,
                    title: "Ethical by Design",
                    desc: "Built with EU AI Act compliance at its core—transparent, auditable, and user-controlled.",
                  },
                  {
                    icon: "brain" as const,
                    title: "Contextual Understanding",
                    desc: "Remembers your emotional patterns to provide increasingly personalized, meaningful interactions.",
                  },
                ].map((feature, i) => (
                  <GlassCard key={i} hover>
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-3">
                        <AnimatedIcon type={feature.icon} />
                      </div>
                      <h3 className="mb-3 text-xl font-semibold text-white">{feature.title}</h3>
                      <p className="leading-relaxed text-slate-300/80">{feature.desc}</p>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          </section>
        </RevealOnScroll>

        <RevealOnScroll delay={0.2}>
          <section className="bg-slate-900/30 px-4 py-20">
            <div className="mx-auto max-w-6xl">
              <div className="mb-16 text-center">
                <h2 className="gradient-text mb-4 text-3xl font-bold md:text-4xl">How Buddy AI Works</h2>
                <p className="mx-auto max-w-2xl text-slate-300/90">Three simple steps to emotionally intelligent conversations.</p>
              </div>

              <div className="relative grid gap-8 md:grid-cols-3">
                <div className="absolute left-1/4 right-1/4 top-12 hidden h-0.5 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent md:block" />

                {[
                  { step: "1", title: "Connect", desc: "Start a conversation naturally—no setup required." },
                  { step: "2", title: "Feel", desc: "Buddy reads emotional context and adapts in real-time." },
                  { step: "3", title: "Grow", desc: "Your interactions help Buddy learn and improve for you." },
                ].map((item, i) => (
                  <div key={i} className="relative text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-700 text-2xl font-bold text-white shadow-lg shadow-violet-500/20">
                      {item.step}
                    </div>
                    <h3 className="mb-3 text-xl font-semibold text-white">{item.title}</h3>
                    <p className="text-slate-300/80">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </RevealOnScroll>

        <RevealOnScroll delay={0.4}>
          <section className="px-4 py-16">
            <div className="mx-auto max-w-4xl">
              <GlassCard hover={false} className="relative overflow-hidden">
                <div className="neon-border pointer-events-none absolute inset-0 rounded-2xl opacity-30" />

                <div className="relative z-10 flex flex-col items-center gap-6 p-6 md:flex-row">
                  <div className="relative">
                    <div
                      className="flex h-16 w-16 animate-spin-slow items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500"
                      style={{ animationDuration: "20s" }}
                    >
                      <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </div>
                    <div className="absolute inset-0 animate-ping rounded-full border-2 border-cyan-400/30" />
                  </div>

                  <div className="text-center md:text-left">
                    <h3 className="mb-2 text-xl font-semibold text-white">EU AI Act Compliant</h3>
                    <p className="mb-4 text-slate-300/80">
                      Buddy AI is built from the ground up to meet the highest standards of transparency, accountability, and user rights under the
                      EU AI Act.
                    </p>
                    <Link href="/eu-ai-act" className="inline-flex items-center gap-2 font-medium text-cyan-400 transition-colors hover:text-cyan-300">
                      View Compliance Documentation
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </GlassCard>
            </div>
          </section>
        </RevealOnScroll>

        <RevealOnScroll delay={0.6}>
          <section className="px-4 py-20">
            <div className="mx-auto max-w-6xl">
              <div className="mb-12 text-center">
                <h2 className="gradient-text mb-4 text-3xl font-bold md:text-4xl">Loved by Early Users</h2>
                <p className="text-slate-300/90">Real stories from our beta community</p>
              </div>

              <div className="relative overflow-hidden rounded-2xl">
                <div ref={scrollRef} className="scrollbar-hide flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4">
                  {[
                    {
                      name: "Sarah K.",
                      role: "Therapist",
                      quote:
                        "Buddy helps me practice empathetic responses before difficult client sessions. It's like having a compassionate rehearsal partner.",
                      avatar: "https://ui-avatars.com/api/?name=Sarah+K&background=7c3aed&color=fff",
                    },
                    {
                      name: "Marcus T.",
                      role: "Startup Founder",
                      quote:
                        "Finally an AI that doesn't feel robotic. Buddy adapts to my stress levels during crunch time and actually helps me decompress.",
                      avatar: "https://ui-avatars.com/api/?name=Marcus+T&background=06b6d4&color=fff",
                    },
                    {
                      name: "Elena R.",
                      role: "Student",
                      quote:
                        "As someone with anxiety, having an AI that recognizes when I'm overwhelmed and adjusts its tone has been genuinely supportive.",
                      avatar: "https://ui-avatars.com/api/?name=Elena+R&background=ec4899&color=fff",
                    },
                  ].map((testimonial, i) => (
                    <motion.div key={i} className="min-w-[300px] snap-start md:min-w-[400px]" whileHover={{ scale: 1.02 }}>
                      <GlassCard className="h-full">
                        <div className="flex h-full flex-col">
                          <div className="mb-4 flex items-center gap-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={testimonial.avatar}
                              alt={testimonial.name}
                              className="h-12 w-12 rounded-full border-2 border-violet-500/30"
                              width={48}
                              height={48}
                            />
                            <div>
                              <div className="font-semibold text-white">{testimonial.name}</div>
                              <div className="text-sm text-slate-400">{testimonial.role}</div>
                            </div>
                          </div>
                          <p className="flex-1 leading-relaxed text-slate-300/90">&ldquo;{testimonial.quote}&rdquo;</p>
                          <div className="mt-4 flex gap-1">
                            {[0, 1, 2, 3, 4].map((j) => (
                              <svg key={j} className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-6 flex justify-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to testimonial ${i + 1}`}
                      onClick={() => scrollToCard(i)}
                      className={`h-2 rounded-full transition-all ${i === carouselIndex ? "w-4 bg-cyan-400" : "w-2 bg-slate-600 hover:bg-slate-500"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </RevealOnScroll>

        <RevealOnScroll delay={0.8}>
          <section className="px-4 py-20">
            <div className="mx-auto max-w-4xl text-center">
              <GlassCard hover={false} className="p-8 md:p-12">
                <h2 className="gradient-text mb-6 text-3xl font-bold md:text-4xl">Ready to Experience Emotionally Intelligent AI?</h2>
                <p className="mx-auto mb-8 max-w-2xl text-slate-300/90">
                  Join thousands of users who are already building deeper, more meaningful connections with AI.
                </p>

                <Link href="/register" className="inline-flex">
                  <motion.span
                    className="group relative inline-flex cursor-pointer overflow-hidden rounded-full px-10 py-5 text-lg font-semibold text-white"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="neon-border absolute inset-0 rounded-full opacity-70" />
                    <span className="absolute inset-[2px] rounded-full bg-slate-900" />
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      Start Your Free Trial
                      <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </motion.span>
                </Link>

                <p className="mt-6 text-sm text-slate-500">No credit card required • Cancel anytime • EU AI Act compliant</p>
              </GlassCard>
            </div>
          </section>
        </RevealOnScroll>

        <footer className="border-t border-slate-800/50 px-4 py-12">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-cyan-500">
                  <span className="text-sm font-bold text-white">B</span>
                </div>
                <span className="font-semibold text-white">Buddy AI</span>
              </div>

              <nav className="flex flex-wrap justify-center gap-6 text-sm">
                {[
                  { label: "Features", href: "/docs" },
                  { label: "Compliance", href: "/eu-ai-act" },
                  { label: "Pricing", href: "/pricing" },
                  { label: "Blog", href: "/blog" },
                  { label: "Contact", href: "/privacy" },
                ].map((item) => (
                  <Link key={item.label} href={item.href} className="group relative text-slate-400 transition-colors hover:text-cyan-400">
                    {item.label}
                    <span className="absolute -bottom-1 left-0 h-px w-0 bg-cyan-400 transition-all group-hover:w-full" />
                  </Link>
                ))}
              </nav>

              <div className="text-sm text-slate-500">© {new Date().getFullYear()} Buddy AI. All rights reserved.</div>
            </div>

            <div className="mt-8 border-t border-slate-800/30 pt-8 text-center text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400/50" />
                Powered by emotional intelligence technology
              </span>
            </div>
          </div>
        </footer>
      </motion.div>
    </>
  );
}
