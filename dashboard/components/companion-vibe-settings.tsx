"use client";

import { useEffect, useState } from "react";
import { PERSONALITY_CHOICES, type CompanionPersonality } from "@/lib/companion-mood";
import {
  clearCheckIns,
  defaultDisplayPrefs,
  loadDisplayPrefs,
  loadOracleStyle,
  loadPersonality,
  saveDisplayPrefs,
  saveOracleStyle,
  savePersonality,
  type BuddyDisplayPrefs,
} from "@/lib/mood-memory";
import {
  loadIdentity,
  patchIdentity,
  resetIdentity,
  type AnimationPersonality,
  type AuraId,
} from "@/lib/buddy-identity";
import { selectAura } from "@/lib/buddy-universe";
import { AURA_CATALOG } from "@/lib/orb-evolution";
import { MemoryConstellationPanel } from "@/components/memory-constellation-panel";

const ANIMATIONS: Array<{ id: AnimationPersonality; label: string }> = [
  { id: "soft", label: "Soft" },
  { id: "playful", label: "Playful" },
  { id: "still-glow", label: "Still glow" },
];

const THEMES: Array<{ id: BuddyDisplayPrefs["theme"]; label: string }> = [
  { id: "cosmic", label: "Cosmic" },
  { id: "ember", label: "Ember" },
  { id: "mist", label: "Mist" },
  { id: "night", label: "Night" },
];

export function CompanionVibeSettings() {
  const [vibe, setVibe] = useState<CompanionPersonality>("warm");
  const [oracleStyle, setOracleStyle] = useState<"cosmic" | "pandit">("cosmic");
  const [aura, setAura] = useState<AuraId>("ember");
  const [unlocked, setUnlocked] = useState<AuraId[]>(["ember"]);
  const [animation, setAnimation] = useState<AnimationPersonality>("soft");
  const [prefs, setPrefs] = useState<BuddyDisplayPrefs>(defaultDisplayPrefs());
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setVibe(loadPersonality());
    setOracleStyle(loadOracleStyle());
    const identity = loadIdentity();
    setAura(identity.auraId);
    setUnlocked(identity.unlocked);
    setAnimation(identity.animation);
    setPrefs(loadDisplayPrefs());
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h2 className="text-sm font-medium text-white/70">Companion vibe</h2>
        <p className="mt-1 text-xs text-white/35">Local to this device. This is your Buddy — not a diagnosis.</p>
        <div className="mt-4 grid grid-cols-1 gap-2">
          {PERSONALITY_CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => {
                savePersonality(choice.id);
                setVibe(choice.id);
              }}
              className={`min-h-12 rounded-xl border px-4 py-3 text-left ${
                vibe === choice.id ? "border-white/35 bg-white/10 text-white" : "border-white/8 bg-black/20 text-white/70"
              }`}
            >
              <span className="block text-sm">{choice.label}</span>
              <span className="text-xs text-white/40">{choice.hint}</span>
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-white/30">Orb aura</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {AURA_CATALOG.map((item) => {
            const open = unlocked.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={!open}
                onClick={() => setAura(selectAura(item.id).auraId)}
                className={`min-h-11 rounded-full border px-3 text-xs ${
                  aura === item.id
                    ? "border-white/35 text-white"
                    : open
                      ? "border-white/12 text-white/60"
                      : "border-white/5 text-white/25"
                }`}
              >
                {item.title}
                {open ? "" : " · soon"}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-white/30">Auras unlock by showing up — not by paying.</p>

        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-white/30">Animation</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ANIMATIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                patchIdentity({ animation: item.id });
                setAnimation(item.id);
              }}
              className={`min-h-11 rounded-full border px-3 text-xs ${
                animation === item.id ? "border-white/35 text-white" : "border-white/12 text-white/55"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-white/30">Theme</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPrefs(saveDisplayPrefs({ theme: item.id }))}
              className={`min-h-11 rounded-full border px-3 text-xs ${
                prefs.theme === item.id ? "border-white/35 text-white" : "border-white/12 text-white/55"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-white/30">Motion &amp; power</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["auto", "Match device"],
              ["reduce", "Reduced motion"],
              ["full", "Full motion"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPrefs(saveDisplayPrefs({ motion: id }))}
              className={`min-h-11 rounded-full border px-3 text-xs ${
                prefs.motion === id ? "border-white/35 text-white" : "border-white/12 text-white/55"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPrefs(saveDisplayPrefs({ lowPower: !prefs.lowPower }))}
            className={`min-h-11 rounded-full border px-3 text-xs ${
              prefs.lowPower ? "border-amber-300/40 text-amber-100" : "border-white/12 text-white/55"
            }`}
          >
            Low power {prefs.lowPower ? "on" : "off"}
          </button>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              saveOracleStyle("cosmic");
              setOracleStyle("cosmic");
            }}
            className={`min-h-11 rounded-full border px-4 text-xs ${
              oracleStyle === "cosmic" ? "border-white/30 text-white" : "border-white/10 text-white/45"
            }`}
          >
            Cosmic Oracle
          </button>
          <button
            type="button"
            onClick={() => {
              saveOracleStyle("pandit");
              setOracleStyle("pandit");
            }}
            className={`min-h-11 rounded-full border px-4 text-xs ${
              oracleStyle === "pandit" ? "border-white/30 text-white" : "border-white/10 text-white/45"
            }`}
          >
            Pandit-inspired
          </button>
        </div>

        <button
          type="button"
          className="mt-6 block text-xs text-rose-200/70 hover:text-rose-100"
          onClick={() => {
            if (!window.confirm("Delete all local mood check-ins on this device? This cannot be undone.")) return;
            clearCheckIns();
            setStatus("Local mood history deleted on this device.");
          }}
        >
          Delete local mood history
        </button>
        <button
          type="button"
          className="mt-3 block text-xs text-white/30 hover:text-white/50"
          onClick={() => {
            if (!window.confirm("Reset Buddy discoveries (auras, rituals, unlocks) on this device?")) return;
            resetIdentity();
            const identity = loadIdentity();
            setAura(identity.auraId);
            setUnlocked(identity.unlocked);
            setAnimation(identity.animation);
            setStatus("Discoveries reset on this device.");
          }}
        >
          Reset Buddy discoveries
        </button>
        {status ? <p className="mt-3 text-xs text-emerald-200/70" role="status">{status}</p> : null}
        <p className="mt-3 text-[11px] leading-relaxed text-white/30">
          Mood check-ins stay on this device. They are not public, not sold, and are not medical data.
        </p>
      </div>

      <MemoryConstellationPanel />
    </section>
  );
}
