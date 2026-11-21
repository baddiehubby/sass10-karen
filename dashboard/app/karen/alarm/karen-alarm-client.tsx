"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  KAREN_ALARM_RAGE_OPTIONS,
  readKarenAlarmConfig,
  saveKarenAlarmConfig,
  type KarenAlarmRage,
  writeKarenAlarmEnabled,
  clearKarenAlarmTime,
} from "@/lib/karen/alarm-storage";
import {
  cancelKarenNativeAlarm,
  ensureKarenExactAlarmPermission,
  isKarenNativePlatform,
  scheduleKarenAlarm,
} from "@/lib/karen/native-alarm";

/**
 * Wake-Up alarm settings.
 *
 * Android: `LocalNotifications.schedule()` with exact + allowWhileIdle fires
 * even when the app is closed (requires SCHEDULE_EXACT_ALARM). Tap opens the
 * 3D Karen dismissal challenge — no snooze.
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseHHmm(value: string): { h: number; m: number } {
  const [hs, ms] = value.split(":");
  const h = Math.min(23, Math.max(0, Number(hs) || 0));
  const m = Math.min(59, Math.max(0, Number(ms) || 0));
  return { h, m };
}

function formatDisplay(hhmm: string): string {
  const { h, m } = parseHHmm(hhmm);
  const ampm = h >= 12 ? "PM" : "AM";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${pad2(m)} ${ampm}`;
}

export function KarenAlarmClient() {
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [rage, setRage] = useState<KarenAlarmRage>("furious");
  const [enabled, setEnabled] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [isNative, setIsNative] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const time = useMemo(() => `${pad2(hour)}:${pad2(minute)}`, [hour, minute]);

  useEffect(() => {
    setIsNative(isKarenNativePlatform());
    const cfg = readKarenAlarmConfig();
    if (cfg.time) {
      const parsed = parseHHmm(cfg.time);
      setHour(parsed.h);
      setMinute(parsed.m);
    }
    setRage(cfg.rage);
    setEnabled(cfg.enabled || Boolean(cfg.time));
    setHydrated(true);
  }, []);

  const bumpHour = useCallback((delta: number) => {
    setHour((h) => (h + delta + 24) % 24);
  }, []);

  const bumpMinute = useCallback((delta: number) => {
    setMinute((m) => {
      const next = m + delta;
      if (next >= 60) {
        setHour((h) => (h + 1) % 24);
        return 0;
      }
      if (next < 0) {
        setHour((h) => (h + 23) % 24);
        return 55;
      }
      // Snap to 5-minute steps for big-picker feel.
      return Math.round(next / 5) * 5;
    });
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setScheduling(true);
    try {
      saveKarenAlarmConfig({ time, rage, enabled: true });
      setEnabled(true);
      const result = await scheduleKarenAlarm(time);
      setDetail(
        result.ok
          ? `Armed ${formatDisplay(time)} · ${rage} rage. ${result.detail}`
          : result.detail,
      );
    } finally {
      setScheduling(false);
    }
  }

  async function onClear() {
    setScheduling(true);
    try {
      await cancelKarenNativeAlarm();
      clearKarenAlarmTime();
      writeKarenAlarmEnabled(false);
      setEnabled(false);
      setDetail("Alarm cleared.");
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-lg flex-col overflow-y-auto overscroll-contain bg-[radial-gradient(ellipse_at_top,_#1a0508_0%,_#050505_55%,_#000_100%)] px-4 py-8 text-white">
      <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-rose-400/85">
        Karen · Alarm
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-geist-sans)] text-3xl font-black tracking-tight">
        Wake-Up Call
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        {isNative
          ? "Capacitor exact alarm — fires while the app is closed. No snooze: yell I'M AWAKE or solve math."
          : "Browser mode saves to localStorage. Install the Karen Android app for closed-app wake alarms."}
      </p>

      <form onSubmit={(e) => void onSave(e)} className="mt-8 space-y-8">
        {/* Large time picker */}
        <div className="rounded-3xl border border-white/10 bg-black/50 p-6 shadow-[0_0_60px_rgba(244,63,94,0.12)] backdrop-blur-sm">
          <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
            Alarm time
          </p>
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            <TimeColumn
              label="Hour"
              value={pad2(hour)}
              onUp={() => bumpHour(1)}
              onDown={() => bumpHour(-1)}
            />
            <span className="pb-6 text-5xl font-black text-rose-400/80 sm:text-6xl">:</span>
            <TimeColumn
              label="Min"
              value={pad2(minute)}
              onUp={() => bumpMinute(5)}
              onDown={() => bumpMinute(-5)}
            />
          </div>
          <p className="mt-5 text-center text-lg font-semibold text-rose-200/90">
            {hydrated ? formatDisplay(time) : "—"}
          </p>
          <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                const on = e.target.checked;
                setEnabled(on);
                writeKarenAlarmEnabled(on);
                if (on) saveKarenAlarmConfig({ time, rage, enabled: true });
              }}
              className="h-4 w-4 accent-rose-500"
            />
            Alarm enabled
          </label>
        </div>

        {/* Karen's Wake-Up Rage */}
        <fieldset className="space-y-3">
          <legend className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">
            Karen&apos;s Wake-Up Rage
          </legend>
          <div className="grid gap-2">
            {KAREN_ALARM_RAGE_OPTIONS.map((opt) => {
              const active = rage === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRage(opt.id)}
                  className={`rounded-2xl border px-4 py-3.5 text-left transition-[border-color,background,box-shadow] ${
                    active
                      ? "border-rose-400/70 bg-rose-950/60 shadow-[0_0_24px_rgba(244,63,94,0.25)]"
                      : "border-white/10 bg-zinc-950/70 hover:border-white/25"
                  }`}
                >
                  <span className="block text-sm font-black uppercase tracking-[0.16em] text-white">
                    {opt.label}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-400">{opt.blurb}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={scheduling}
            className="flex-1 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 px-4 py-3.5 text-sm font-black uppercase tracking-[0.18em] text-white disabled:opacity-50"
          >
            {scheduling ? "Saving…" : isNative ? "Schedule native alarm" : "Save alarm"}
          </button>
          <button
            type="button"
            disabled={scheduling}
            onClick={() => void onClear()}
            className="rounded-2xl border border-white/15 px-4 py-3.5 text-sm font-semibold text-zinc-300 disabled:opacity-50"
          >
            Clear
          </button>
        </div>

        {isNative ? (
          <button
            type="button"
            disabled={scheduling}
            onClick={() => {
              void (async () => {
                setScheduling(true);
                try {
                  const exact = await ensureKarenExactAlarmPermission();
                  setDetail(exact.detail);
                } finally {
                  setScheduling(false);
                }
              })();
            }}
            className="w-full rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-amber-100 disabled:opacity-50"
          >
            Grant exact alarm permission
          </button>
        ) : null}

        {detail ? <p className="text-xs leading-relaxed text-zinc-400">{detail}</p> : null}
      </form>

      <Link
        href="/karen"
        className="mt-10 text-center text-sm text-rose-400 underline-offset-4 hover:underline"
      >
        ← Back to Karen
      </Link>
    </div>
  );
}

function TimeColumn({
  label,
  value,
  onUp,
  onDown,
}: {
  label: string;
  value: string;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onUp}
        className="h-10 w-16 rounded-xl border border-white/15 bg-white/5 text-lg text-zinc-200 hover:bg-white/10"
        aria-label={`Increase ${label}`}
      >
        ▲
      </button>
      <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-rose-500/30 bg-black/70 sm:h-28 sm:w-28">
        <span className="font-mono text-5xl font-black tabular-nums tracking-tight text-white sm:text-6xl">
          {value}
        </span>
      </div>
      <button
        type="button"
        onClick={onDown}
        className="h-10 w-16 rounded-xl border border-white/15 bg-white/5 text-lg text-zinc-200 hover:bg-white/10"
        aria-label={`Decrease ${label}`}
      >
        ▼
      </button>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
    </div>
  );
}
