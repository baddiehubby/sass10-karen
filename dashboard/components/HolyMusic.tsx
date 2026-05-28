"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type HolyMusicProps = {
  enabled: boolean;
  onLevel?: (level: number) => void;
};

const MUTED_KEY = "sacha_music_muted";
const STARTED_KEY = "sacha_music_started";

export function HolyMusic({ enabled, onLevel }: HolyMusicProps) {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(MUTED_KEY) === "1");
      setStarted(window.localStorage.getItem(STARTED_KEY) === "1");
    } catch {
      setMuted(false);
      setStarted(false);
    }
  }, []);

  const createSpiritualDrone = useCallback(async () => {
    if (ctxRef.current) return;
    const ctx = new window.AudioContext();
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    gainRef.current = master;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const lowA = ctx.createOscillator();
    lowA.type = "sine";
    lowA.frequency.value = 110;
    const lowB = ctx.createOscillator();
    lowB.type = "sine";
    lowB.frequency.value = 146.83;
    const high = ctx.createOscillator();
    high.type = "sine";
    high.frequency.value = 880;

    const lowAGain = ctx.createGain();
    const lowBGain = ctx.createGain();
    const highGain = ctx.createGain();
    lowAGain.gain.value = 0.045;
    lowBGain.gain.value = 0.038;
    highGain.gain.value = 0.006;

    const shimmerLfo = ctx.createOscillator();
    shimmerLfo.type = "sine";
    shimmerLfo.frequency.value = 0.08;
    const shimmerDepth = ctx.createGain();
    shimmerDepth.gain.value = 0.004;
    shimmerLfo.connect(shimmerDepth).connect(highGain.gain);

    const breathLfo = ctx.createOscillator();
    breathLfo.type = "sine";
    breathLfo.frequency.value = 0.05;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = 0.012;
    breathLfo.connect(breathDepth).connect(master.gain);

    lowA.connect(lowAGain).connect(master);
    lowB.connect(lowBGain).connect(master);
    high.connect(highGain).connect(master);
    master.connect(analyser).connect(ctx.destination);

    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0.02, now);
    master.gain.linearRampToValueAtTime(0.08, now + 5);

    [lowA, lowB, high, shimmerLfo, breathLfo].forEach((o) => o.start());
    if (ctx.state === "suspended") await ctx.resume();

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
      onLevel?.(avg);
      rafRef.current = window.requestAnimationFrame(tick);
    };
    tick();
  }, [onLevel]);

  useEffect(() => {
    if (!enabled) return;
    const onUserGesture = async () => {
      if (muted || started) return;
      await createSpiritualDrone();
      setStarted(true);
      try {
        window.localStorage.setItem(STARTED_KEY, "1");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("click", onUserGesture, { passive: true });
    window.addEventListener("touchstart", onUserGesture, { passive: true });
    return () => {
      window.removeEventListener("click", onUserGesture);
      window.removeEventListener("touchstart", onUserGesture);
    };
  }, [enabled, muted, started, createSpiritualDrone]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try {
      window.localStorage.setItem(MUTED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (gainRef.current) {
      const now = ctxRef.current?.currentTime || 0;
      gainRef.current.gain.cancelScheduledValues(now);
      gainRef.current.gain.linearRampToValueAtTime(next ? 0.0001 : 0.08, now + 0.35);
    }
  }

  useEffect(
    () => () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      if (ctxRef.current) void ctxRef.current.close();
    },
    [],
  );

  if (!enabled) return null;
  return (
    <button
      type="button"
      onClick={toggleMute}
      className="fixed bottom-6 right-6 z-50 rounded-full border border-amber-200/30 bg-black/35 px-3 py-2 text-xs text-amber-100 backdrop-blur"
    >
      {muted ? "🔊 Unmute" : "🔇 Mute"}
    </button>
  );
}

