"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Float, MeshDistortMaterial, Sphere } from "@react-three/drei";
import { motion, useScroll, useTransform } from "framer-motion";
import { Check, Heart, Monitor, Shield, Sparkles, Zap } from "lucide-react";

const PLANS = [
  {
    name: "Buddy",
    slug: "buddy",
    price: 9,
    period: "month",
    description: "Your personal AI companion on one device",
    features: [
      "Hallucination detection",
      "Basic mood tracking",
      "1 device",
    ],
    cta: "Start 14‑Day Trial",
    popular: false,
  },
  {
    name: "Buddy Pro",
    slug: "buddy-pro",
    price: 19,
    period: "month",
    description: "Emotional memory and sync across your AI tools",
    features: [
      "Emotional memory",
      "Cross-platform sync",
      "Priority companion responses",
      "3 devices",
    ],
    cta: "Start 14‑Day Trial",
    popular: true,
  },
  {
    name: "Buddy Family",
    slug: "buddy-family",
    price: 29,
    period: "month",
    description: "Companion safety for everyone at home",
    features: [
      "Everything in Pro",
      "Family safety dashboard",
      "Custom glow themes",
      "Unlimited devices",
      "Parental controls",
    ],
    cta: "Start 14‑Day Trial",
    popular: false,
  },
];

function PremiumOrb() {
  const [mood, setMood] = useState<"warm" | "purple" | "cyan" | "glow">("warm");

  const moodConfig: Record<string, { color: string; distort: number; speed: number; ring: string }> = {
    warm: { color: "#f59e0b", distort: 0.2, speed: 1.5, ring: "#fbbf24" },
    purple: { color: "#a855f7", distort: 0.15, speed: 1, ring: "#c084fc" },
    cyan: { color: "#22d3ee", distort: 0.25, speed: 2, ring: "#67e8f9" },
    glow: { color: "#f472b6", distort: 0.18, speed: 1.2, ring: "#fb7185" },
  };

  useEffect(() => {
    const moods: Array<typeof mood> = ["warm", "purple", "cyan", "glow"];
    const interval = setInterval(() => {
      setMood((prev) => {
        const idx = moods.indexOf(prev);
        return moods[(idx + 1) % moods.length]!;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const config = moodConfig[mood]!;

  return (
    <div className="relative mx-auto mb-10 h-72 w-72">
      <Canvas camera={{ position: [0, 0, 5], fov: 40 }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1.2} color={config.color} />
        <pointLight position={[-10, -10, -10]} intensity={0.6} color="#64748b" />

        <Suspense fallback={null}>
          <Float speed={config.speed} rotationIntensity={0.3} floatIntensity={0.3}>
            <Sphere args={[1.3, 72, 72]}>
              <MeshDistortMaterial
                color={config.color}
                attach="material"
                distort={config.distort}
                speed={config.speed * 1.5}
                roughness={0.1}
                metalness={0.9}
                emissive={config.color}
                emissiveIntensity={0.4}
                clearcoat={1}
                clearcoatRoughness={0.1}
              />
            </Sphere>
          </Float>

          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.7, 0.03, 24, 120]} />
            <meshStandardMaterial
              color={config.ring}
              emissive={config.ring}
              emissiveIntensity={3}
              transparent
              opacity={0.7}
            />
          </mesh>

          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[1.9, 0.02, 16, 100]} />
            <meshStandardMaterial
              color={config.color}
              emissive={config.color}
              emissiveIntensity={2}
              transparent
              opacity={0.5}
            />
          </mesh>

          <Environment preset="studio" />
        </Suspense>
      </Canvas>

      <motion.div
        className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-medium text-slate-300">
            {mood === "warm" && "Gentle warning when AI is wrong"}
            {mood === "purple" && "Remembers how you felt"}
            {mood === "cyan" && "Always on in your browser"}
            {mood === "glow" && "Watching out for you"}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function CompanionTagline() {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
      <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
      <span>Your always-on AI companion — watching out for you</span>
    </div>
  );
}

export default function BuddyAIPremiumHomepage() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, -30]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <div className="fixed inset-0 z-0">
        <div
          className="animate-float absolute h-[800px] w-[800px] rounded-full opacity-20 mix-blend-screen blur-[120px]"
          style={{
            background: "radial-gradient(circle, #a855f7 0%, transparent 70%)",
            top: "-200px",
            right: "-200px",
          }}
        />
        <div
          className="animate-float absolute h-[600px] w-[600px] rounded-full opacity-15 mix-blend-screen blur-[100px]"
          style={{
            background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)",
            bottom: "-100px",
            left: "-100px",
            animationDelay: "-5s",
          }}
        />
      </div>

      <motion.div className="relative z-10" style={{ y: heroY }}>
        <section className="flex min-h-screen items-center justify-center px-4 pb-20 pt-16">
          <div className="mx-auto max-w-6xl text-center">
            <PremiumOrb />

            <motion.h1
              className="mb-6 text-4xl font-bold leading-tight md:text-6xl lg:text-7xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="bg-gradient-to-r from-amber-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                Your AI Sidekick That Keeps You Sane
              </span>
            </motion.h1>

            <motion.p
              className="mx-auto mb-8 max-w-3xl text-lg leading-relaxed text-slate-300 md:text-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              The friendly companion that glows when AI is wrong, remembers how you feel, and keeps you safe
              across ChatGPT, Claude, and Gemini.
            </motion.p>

            <motion.div
              className="mb-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <CompanionTagline />
            </motion.div>

            <motion.div
              className="mb-12 flex flex-col justify-center gap-4 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <motion.a
                href="/register?plan=buddy-pro"
                className="group relative overflow-hidden rounded-full px-8 py-4 font-semibold text-white"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-cyan-500 opacity-90" />
                <div className="absolute inset-0.5 rounded-full bg-slate-900" />
                <span className="relative z-10 flex items-center gap-2">Start 14‑Day Trial →</span>
              </motion.a>

              <motion.a
                href="/demo"
                className="rounded-full border border-slate-700 bg-slate-900/60 px-8 py-4 font-semibold text-white/90 backdrop-blur-sm transition-all duration-300 hover:border-violet-400/50 hover:bg-slate-800/80"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
              >
                Watch 90‑Second Demo
              </motion.a>
            </motion.div>

            <motion.div
              className="flex flex-wrap justify-center gap-6 text-sm text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                <span>Hallucination Detection Active</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-400" />
                <span>21.5 KB Widget</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-fuchsia-400" />
                <span>Real-time hallucination protection + emotional support</span>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">Your AI Buddy, Always With You</h2>
              <p className="mx-auto max-w-2xl text-slate-300">
                Trust-first protection and emotional support — not another compliance checkbox.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  icon: Shield,
                  title: "Prevents AI Hallucinations",
                  desc: "Your buddy glows with a gentle warning when ChatGPT or Claude confidently gets it wrong. Stay informed, not misled.",
                  stat: "27%",
                  statLabel: "of AI responses contain errors",
                },
                {
                  icon: Heart,
                  title: "Emotional Memory Across Sessions",
                  desc: "Your buddy remembers how you felt yesterday and checks in today. Build a relationship, not just a chat.",
                  stat: "37%",
                  statLabel: "higher retention with companion avatars",
                },
                {
                  icon: Monitor,
                  title: "Always-On Browser Presence",
                  desc: "A tiny, glowing companion that lives in the corner of your screen across all AI platforms. Never alone with AI.",
                  stat: "<5 min",
                  statLabel: "setup",
                },
              ].map((feat, i) => (
                <motion.div
                  key={i}
                  className="relative rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-600/20 to-fuchsia-500/20">
                    <feat.icon className="h-6 w-6 text-amber-400" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-white">{feat.title}</h3>
                  <p className="mb-4 text-slate-300/90">{feat.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-amber-400">{feat.stat}</span>
                    <span className="text-sm text-slate-400">{feat.statLabel}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-900/30 px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">Choose Your Buddy</h2>
              <p className="mx-auto max-w-2xl text-slate-300">
                Companion plans that grow with you — from solo sidekick to family safety.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {PLANS.map((plan, i) => (
                <motion.div
                  key={plan.name}
                  className={`relative rounded-2xl border p-8 backdrop-blur-sm ${
                    plan.popular
                      ? "border-violet-500/50 bg-gradient-to-b from-violet-900/20 to-slate-900/40"
                      : "border-slate-800 bg-slate-900/40"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-1 text-xs font-medium text-white">
                      Most Popular
                    </div>
                  )}
                  <h3 className="mb-2 text-xl font-bold text-white">{plan.name}</h3>
                  <p className="mb-4 text-sm text-slate-400">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-slate-400">/{plan.period}</span>
                    <p className="mt-1 text-xs text-slate-500">Billed annually, cancel anytime</p>
                  </div>
                  <ul className="mb-8 space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                        <span className="text-sm text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`/register?plan=${plan.slug}`}
                    className={`block w-full rounded-lg py-3 px-4 text-center font-semibold transition-all ${
                      plan.popular
                        ? "bg-gradient-to-r from-violet-600 to-cyan-500 text-white hover:opacity-90"
                        : "bg-slate-800 text-white hover:bg-slate-700"
                    }`}
                  >
                    {plan.cta}
                  </a>
                </motion.div>
              ))}
            </div>
            <div className="mt-12 text-center text-sm text-slate-400">
              <p>14‑day money‑back guarantee • No credit card required for trial</p>
              <p className="mt-2">
                Enterprise compliance tools available —{" "}
                <a href="/trust-center" className="text-amber-300 hover:text-amber-200">
                  contact us
                </a>
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-20">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/60 to-slate-900/20 p-8 backdrop-blur-sm md:p-12"
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="mb-6 text-3xl font-bold md:text-4xl">Ready to Meet Your AI Sidekick?</h2>
              <p className="mx-auto mb-8 max-w-2xl text-slate-300">
                Join thousands who trust Buddie AI to catch hallucinations, remember how they feel, and stay safe.
              </p>
              <motion.a
                href="/register"
                className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-8 py-4 font-semibold text-white transition-opacity hover:opacity-90"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                Start Your 14‑Day Trial <Zap className="h-5 w-5" />
              </motion.a>
              <p className="mt-6 text-sm text-slate-500">
                No credit card required • Cancel anytime •{" "}
                <a href="/trust-center" className="text-amber-400/80 hover:text-amber-300">
                  Trust Center
                </a>{" "}
                for compliance tools
              </p>
            </motion.div>
          </div>
        </section>

        <footer className="border-t border-slate-800 px-4 py-12">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-amber-500 via-fuchsia-500 to-cyan-400 shadow-lg shadow-amber-500/20"
                aria-hidden
              />
              <div>
                <span className="font-semibold text-white">Buddy AI</span>
                <p className="text-xs text-slate-400">Your AI companion. Always watching out for you.</p>
              </div>
            </div>
            <nav className="flex flex-wrap justify-center gap-6 text-sm">
              <a href="/trust-center" className="text-slate-400 transition-colors hover:text-white">
                Trust Center
              </a>
              <a href="/pricing" className="text-slate-400 transition-colors hover:text-white">
                Pricing
              </a>
              <a href="/docs" className="text-slate-400 transition-colors hover:text-white">
                Docs
              </a>
            </nav>
            <div className="text-sm text-slate-500">© {new Date().getFullYear()} Buddy AI. All rights reserved.</div>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}
