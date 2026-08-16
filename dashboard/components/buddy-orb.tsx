"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type Ref } from "react";
import type { AnimationPersonality, AuraId } from "@/lib/buddy-identity";
import type { BuddyMood } from "@/lib/companion-mood";
import type { UniverseWorld } from "@/lib/universe-flags";
import {
  deriveOrbVisualState,
  type OrbEnergy,
  type OrbInteraction,
} from "@/lib/orb-state";

type BuddyOrbProps = {
  mood: BuddyMood;
  size?: number;
  interactive?: boolean;
  reducedMotion?: boolean;
  onActivate?: () => void;
  label?: string;
  aura?: AuraId;
  animation?: AnimationPersonality;
  world?: UniverseWorld;
  seasonal?: string;
  evolutionClass?: string;
  interaction?: OrbInteraction;
  energy?: OrbEnergy;
  valence?: number;
  arousal?: number;
  evolution?: string;
};

export function BuddyOrb({
  mood,
  size = 220,
  interactive = true,
  reducedMotion,
  onActivate,
  label = "Buddy companion",
  aura = "ember",
  animation = "soft",
  world = "buddy",
  seasonal,
  evolutionClass,
  interaction = "idle",
  energy = "present",
  valence,
  arousal,
  evolution,
}: BuddyOrbProps) {
  const wrapRef = useRef<HTMLButtonElement | HTMLDivElement | null>(null);
  const tiltRaf = useRef<number>(0);
  const pendingTilt = useRef({ x: 0, y: 0 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [awake, setAwake] = useState(false);
  const [reduce, setReduce] = useState(Boolean(reducedMotion));
  const [hidden, setHidden] = useState(false);
  const [liveInteraction, setLiveInteraction] = useState<OrbInteraction>(interaction);

  useEffect(() => {
    setLiveInteraction(interaction);
  }, [interaction]);

  useEffect(() => {
    setAwake(true);
    const t = window.setTimeout(() => setAwake(false), 1600);
    return () => window.clearTimeout(t);
  }, [mood, aura, liveInteraction]);

  useEffect(() => {
    if (reducedMotion != null) {
      setReduce(reducedMotion);
      return;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [reducedMotion]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (tiltRaf.current) cancelAnimationFrame(tiltRaf.current);
    };
  }, []);

  const visual = useMemo(
    () =>
      deriveOrbVisualState(
        {
          mood,
          interaction: liveInteraction,
          energy,
          aura,
          animation,
          world,
          seasonal,
          valence,
          arousal,
          evolution: evolution ?? evolutionClass?.replace(/^orb-/, ""),
        },
        { reducedMotion: reduce, hidden },
      ),
    [mood, liveInteraction, energy, aura, animation, world, seasonal, valence, arousal, evolution, evolutionClass, reduce, hidden],
  );

  function onPointerMove(e: PointerEvent<HTMLButtonElement | HTMLDivElement>) {
    if (!interactive || reduce || hidden) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    pendingTilt.current = { x: x * 10, y: y * -10 };
    if (tiltRaf.current) return;
    tiltRaf.current = requestAnimationFrame(() => {
      tiltRaf.current = 0;
      setTilt(pendingTilt.current);
    });
  }

  const scale = (awake ? Math.max(1.04, visual.pulseScale) : visual.pulseScale) ;
  const style = {
    width: size,
    height: size,
    ...visual.styleVars,
    transform: `rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) scale(${scale})`,
  } as CSSProperties;

  const particles =
    visual.particleLevel >= 1 ? (
      <>
        <span className="buddy-orb-particle buddy-orb-particle-a" />
        <span className="buddy-orb-particle buddy-orb-particle-b" />
        {visual.particleLevel >= 2 ? <span className="buddy-orb-particle buddy-orb-particle-c" /> : null}
        {visual.particleLevel >= 3 ? (
          <>
            <span className="buddy-orb-particle buddy-orb-particle-d" />
            <span className="buddy-orb-particle buddy-orb-particle-e" />
          </>
        ) : null}
      </>
    ) : null;

  const inner = (
    <>
      <span className="buddy-orb-halo" />
      <span className="buddy-orb-core" />
      <span className="buddy-orb-shine" />
      <span className="buddy-orb-sigil" />
      {particles}
    </>
  );

  const className = `${visual.className} ${awake ? "buddy-orb-awake" : ""}`.trim();

  if (!interactive) {
    return (
      <div
        ref={wrapRef as Ref<HTMLDivElement>}
        className={className}
        style={style}
        aria-hidden
        onPointerMove={onPointerMove}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      ref={wrapRef as Ref<HTMLButtonElement>}
      type="button"
      className={className}
      style={style}
      aria-label={label}
      title={visual.ariaDescription}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      onClick={() => {
        setAwake(true);
        setLiveInteraction((prev) => (prev === "idle" ? "curious" : prev));
        onActivate?.();
      }}
    >
      {inner}
    </button>
  );
}
