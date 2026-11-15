"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { useNativeAlarm } from "@/hooks/useNativeAlarm";

export function KarenAlarmClient() {
  const { time, setTime, isNative, scheduling, lastDetail, schedule, cancel } =
    useNativeAlarm("07:00");

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{2}:\d{2}$/.test(time)) return;
    await schedule();
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-gradient-to-b from-black via-slate-950 to-black px-4 py-8 text-white">
      <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-rose-400/80">
        Karen · Alarm
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Wake-up call</h1>
      <p className="mt-2 text-sm text-slate-400">
        {isNative
          ? "Native Android notification — can fire even when the app is closed."
          : "Browser mode saves locally. Install the Karen Android app for alarms that survive closing the tab."}
      </p>

      <form
        onSubmit={(e) => void onSave(e)}
        className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-[0_0_40px_rgba(244,63,94,0.12)]"
      >
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Alarm time
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-lg text-white outline-none ring-rose-500/40 focus:ring-2"
            required
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={scheduling}
            className="rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {scheduling ? "Saving…" : "Save alarm"}
          </button>
          <button
            type="button"
            disabled={scheduling}
            onClick={() => void cancel()}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 disabled:opacity-50"
          >
            Clear
          </button>
        </div>

        {time ? (
          <p className="text-sm text-pink-300/90">
            Set for: <span className="font-semibold text-white">{formatDisplay(time)}</span>
          </p>
        ) : (
          <p className="text-sm text-slate-500">No alarm saved.</p>
        )}
        {lastDetail ? <p className="text-xs text-slate-400">{lastDetail}</p> : null}
      </form>

      <Link
        href="/karen"
        className="mt-8 text-center text-sm text-rose-400 underline-offset-4 hover:underline"
      >
        ← Back to Karen
      </Link>
    </div>
  );
}

function formatDisplay(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  let h = Number(hStr);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}
