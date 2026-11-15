"use client";

import { useEffect, useRef, useState } from "react";
import {
  KAREN_ALARM_LAST_FIRED_KEY,
  KAREN_ALARM_WAKE_LINE,
  currentLocalHHmm,
  readKarenAlarmTime,
} from "@/lib/karen/alarm-storage";
import {
  attachKarenNativeAlarmListener,
  KAREN_WAKE_SPEECH,
} from "@/lib/karen/native-alarm";
import { speakWithKaren, stopKarenSpeech, unlockKarenAudio } from "@/lib/karen/voice";

/**
 * Mounted in root layout.
 * - Web: checks every minute against localStorage alarm time.
 * - Native Capacitor: local-notification fire/tap → speakWithKaren("WAKE UP!").
 */
export function KarenAlarmWatcher() {
  const [open, setOpen] = useState(false);
  const speakingRef = useRef(false);

  function fireAlarm() {
    setOpen(true);
    if (speakingRef.current) return;
    speakingRef.current = true;
    void (async () => {
      await unlockKarenAudio();
      // Exact wake line for native notification tap / delivery.
      await speakWithKaren(KAREN_WAKE_SPEECH, "ANGRY");
    })();
  }

  useEffect(() => {
    const tick = () => {
      const alarm = readKarenAlarmTime();
      if (!alarm) return;
      const now = currentLocalHHmm();
      if (now !== alarm) return;

      let lastFired: string | null = null;
      try {
        lastFired = window.localStorage.getItem(KAREN_ALARM_LAST_FIRED_KEY);
      } catch {
        /* ignore */
      }
      const stamp = `${new Date().toDateString()} ${now}`;
      if (lastFired === stamp) return;

      try {
        window.localStorage.setItem(KAREN_ALARM_LAST_FIRED_KEY, stamp);
      } catch {
        /* ignore */
      }

      fireAlarm();
    };

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let handle: { remove: () => Promise<void> } | null = null;
    let cancelled = false;

    void (async () => {
      const h = await attachKarenNativeAlarmListener(() => {
        if (!cancelled) fireAlarm();
      });
      if (cancelled) {
        await h?.remove();
        return;
      }
      handle = h;
    })();

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, []);

  function dismiss() {
    stopKarenSpeech();
    speakingRef.current = false;
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="karen-alarm-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-gradient-to-b from-rose-950 to-black p-8 text-center shadow-[0_0_80px_rgba(244,63,94,0.45)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-rose-400">
          Karen alarm
        </p>
        <h2
          id="karen-alarm-title"
          className="mt-4 text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl"
        >
          Wake up!
        </h2>
        <p className="mt-4 text-base font-medium leading-relaxed text-rose-100/90">
          {KAREN_ALARM_WAKE_LINE}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white"
        >
          I&apos;m up — shut up
        </button>
      </div>
    </div>
  );
}
