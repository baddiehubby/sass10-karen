"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Float, MeshDistortMaterial, Sphere } from "@react-three/drei";
import { motion, useScroll, useTransform } from "framer-motion";
import { Check, Shield, TrendingUp, Users, Zap } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    price: 49,
    period: "month",
    description: "For small businesses starting with AI compliance",
    features: [
      "Emotional safety widget (1 domain)",
      "Basic mood detection (5 emotions)",
      "Monthly compliance reports",
      "Email support",
      "GDPR‑ready data handling",
    ],
    cta: "Start 14‑Day Trial",
    popular: false,
  },
  {
    name: "Agency",
    price: 149,
    period: "month",
    description: "For teams managing multiple client implementations",
    features: [
      "Everything in Starter",
      "Unlimited domains",
      "Advanced mood analytics (12 emotions)",
      "Real‑time compliance alerts",
      "White‑label widget option",
      "Priority support + SLA",
      "Team seats (5 users)",
      "API access",
    ],
    cta: "Start 14‑Day Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: 499,
    period: "month",
    description: "For organizations requiring custom compliance workflows",
    features: [
      "Everything in Agency",
      "Custom emotion models",
      "Dedicated compliance officer",
      "On‑premise deployment option",
      "Custom SLA & support",
      "Unlimited team seats",
      "Advanced audit trails",
      "Quarterly compliance reviews",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

function PremiumOrb() {
  const [mood, setMood] = useState<"secure" | "compliant" | "intelligent" | "trusted">("secure");

  const moodConfig: Record<string, { color: string; distort: number; speed: number }> = {
    secure: { color: "#10b981", distort: 0.2, speed: 1.5 },
    compliant: { color: "#3b82f6", distort: 0.15, speed: 1 },
    intelligent: { color: "#8b5cf6", distort: 0.25, speed: 2 },
    trusted: { color: "#f59e0b", distort: 0.18, speed: 1.2 },
  };

  useEffect(() => {
    const moods: Array<typeof mood> = ["secure", "compliant", "intelligent", "trusted"];
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
              color="#10b981"
              emissive="#10b981"
              emissiveIntensity={3}
              transparent
              opacity={0.7}
            />
          </mesh>

          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[1.9, 0.02, 16, 100]} />
            <meshStandardMaterial
              color="#3b82f6"
              emissive="#3b82f6"
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
          <Shield className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-slate-300">
            {mood === "secure" && "End‑to‑end encrypted"}
            {mood === "compliant" && "EU AI Act ready"}
            {mood === "intelligent" && "Emotion‑aware AI"}
            {mood === "trusted" && "Audit‑ready logs"}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function LiveCounter() {
  const [count, setCount] = useState(1247);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((prev) => prev + Math.floor(Math.random() * 3));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
      <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
      <span>{count.toLocaleString()} businesses protecting their AI chats</span>
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
            background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
            top: "-200px",
            right: "-200px",
          }}
        />
        <div
          className="animate-float absolute h-[600px] w-[600px] rounded-full opacity-15 mix-blend-screen blur-[100px]"
          style={{
            background: "radial-gradient(circle, #10b981 0%, transparent 70%)",
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
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                Emotional Safety
              </span>
              <br />
              <span className="text-white">for Your AI Chat</span>
            </motion.h1>

            <motion.p
              className="mx-auto mb-8 max-w-3xl text-lg leading-relaxed text-slate-300 md:text-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              The only compliance layer that detects emotional risk in real‑time.
              <span className="font-medium text-rose-400"> Avoid EU AI Act fines</span> while building trust.
            </motion.p>

            <motion.div
              className="mb-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <LiveCounter />
            </motion.div>

            <motion.div
              className="mb-12 flex flex-col justify-center gap-4 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <motion.a
                href="/register?plan=agency"
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
                <Shield className="h-4 w-4 text-emerald-400" />
                <span>EU AI Act Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-400" />
                <span>21.5 KB Widget</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-400" />
                <span>Trusted by 1,200+ Teams</span>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">Why Leading Teams Choose Buddy AI</h2>
              <p className="mx-auto max-w-2xl text-slate-300">
                Not just another chat widget. A compliance‑first emotional intelligence layer.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  icon: Shield,
                  title: "Avoid Compliance Fines",
                  desc: "Automated audit trails, DPIA exports, and real‑time alerts keep you aligned with EU AI Act requirements.",
                  stat: "€20M",
                  statLabel: "Max fine avoided",
                },
                {
                  icon: TrendingUp,
                  title: "Increase User Trust",
                  desc: "Detect emotional distress early and adapt responses. Users stay longer and convert higher.",
                  stat: "+34%",
                  statLabel: "Avg. session increase",
                },
                {
                  icon: Zap,
                  title: "Deploy in Minutes",
                  desc: "21.5 KB vanilla JS widget. No framework required. Works with any chat platform.",
                  stat: "<5 min",
                  statLabel: "Average setup time",
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
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-600/20 to-cyan-500/20">
                    <feat.icon className="h-6 w-6 text-violet-400" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-white">{feat.title}</h3>
                  <p className="mb-4 text-slate-300/90">{feat.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-emerald-400">{feat.stat}</span>
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
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">Simple, Premium Pricing</h2>
              <p className="mx-auto max-w-2xl text-slate-300">
                No free tier. No hidden fees. Enterprise‑grade emotional safety.
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
                    href={`/register?plan=${plan.name.toLowerCase()}`}
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
              <p>14‑day money‑back guarantee • No credit card required for trial • GDPR‑compliant data handling</p>
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
              <h2 className="mb-6 text-3xl font-bold md:text-4xl">Ready to Make Your AI Chat Emotionally Safe?</h2>
              <p className="mx-auto mb-8 max-w-2xl text-slate-300">
                Join 1,200+ teams using Buddy AI to build trust, ensure compliance, and avoid costly fines.
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
                No credit card required • Cancel anytime • EU AI Act compliant
              </p>
            </motion.div>
          </div>
        </section>

        <footer className="border-t border-slate-800 px-4 py-12">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-cyan-500">
                <span className="text-sm font-bold text-white">B</span>
              </div>
              <span className="font-semibold text-white">Buddy AI</span>
            </div>
            <nav className="flex flex-wrap justify-center gap-6 text-sm">
              {["Security", "Compliance", "Pricing", "Docs", "Contact"].map((item) => (
                <a
                  key={item}
                  href={`/${item.toLowerCase()}`}
                  className="text-slate-400 transition-colors hover:text-white"
                >
                  {item}
                </a>
              ))}
            </nav>
            <div className="text-sm text-slate-500">© {new Date().getFullYear()} Buddy AI. All rights reserved.</div>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}
