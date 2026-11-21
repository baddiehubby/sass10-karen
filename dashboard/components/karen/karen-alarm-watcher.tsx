"use client";

/**
 * Root-layout alarm poller + full-screen dismissal modal.
 *
 * Web: every 10s, compare local clock to localStorage alarm time.
 * Native Android: `@capacitor/local-notifications` fires even when the app is
 * closed → listener / pending session flag opens this challenge with looping
 * Kokoro WAV + 3D Karen (no snooze — yell I'M AWAKE or solve math).
 */

import { useCallback, useEffect, useState } from "react";

import { KarenAlarmDismissal } from "@/components/karen/karen-alarm-dismissal";
import {
  KAREN_ALARM_LAST_FIRED_KEY,
  KAREN_ALARM_WAKE_LINE,
  KAREN_WAKE_QUERY,
  consumeKarenAlarmPendingWake,
  currentLocalHHmm,
  karenAlarmFireStamp,
  readKarenAlarmEnabled,
  readKarenAlarmRage,
  readKarenAlarmTime,
  type KarenAlarmRage,
} from "@/lib/karen/alarm-storage";
import {
  MORNING_ROAST_LINE,
  markMorningRoastPendingSpeech,
} from "@/lib/karen/morning-roast";
import {
  attachKarenNativeAlarmListener,
  KAREN_WAKE_SPEECH,
} from "@/lib/karen/native-alarm";
import { stopKarenSpeech, unlockKarenAudio } from "@/lib/karen/voice";

/** Poll cadence — catch the alarm minute quickly without burning battery. */
const ALARM_POLL_MS = 10_000;

export function KarenAlarmWatcher() {
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState(KAREN_ALARM_WAKE_LINE);
  const [rage, setRage] = useState<KarenAlarmRage>("furious");

  const fireAlarm = useCallback(
    (opts?: { morningRoast?: boolean; wakeSpeech?: string; rage?: KarenAlarmRage }) => {
      const morning = Boolean(opts?.morningRoast);
      setLine(
        opts?.wakeSpeech?.trim() ||
          (morning ? MORNING_ROAST_LINE : KAREN_ALARM_WAKE_LINE),
      );
      setRage(opts?.rage ?? readKarenAlarmRage());
      setOpen(true);
      if (morning) markMorningRoastPendingSpeech();
      void unlockKarenAudio();
    },
    [],
  );

  // Cold start / deep-link: pending Capacitor wake or ?karenWake=1
  useEffect(() => {
    const pending = consumeKarenAlarmPendingWake();
    if (pending) {
      fireAlarm({
        morningRoast: pending.morningRoast,
        wakeSpeech: pending.wakeSpeech,
        rage: pending.rage,
      });
      return;
    }
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get(KAREN_WAKE_QUERY) === "1") {
        params.delete(KAREN_WAKE_QUERY);
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", next || window.location.pathname);
        fireAlarm({
          wakeSpeech: KAREN_WAKE_SPEECH,
          rage: readKarenAlarmRage(),
        });
      }
    } catch {
      /* ignore */
    }
  }, [fireAlarm]);

  // In-app poll — every 10 seconds (tab / WebView must be alive).
  useEffect(() => {
    const tick = () => {
      if (!readKarenAlarmEnabled()) return;
      const alarm = readKarenAlarmTime();
      if (!alarm) return;
      const now = currentLocalHHmm();
      if (now !== alarm) return;

      const stamp = karenAlarmFireStamp(now);
      let lastFired: string | null = null;
      try {
        lastFired = window.localStorage.getItem(KAREN_ALARM_LAST_FIRED_KEY);
      } catch {
        /* ignore */
      }
      if (lastFired === stamp) return;

      try {
        window.localStorage.setItem(KAREN_ALARM_LAST_FIRED_KEY, stamp);
      } catch {
        /* ignore */
      }

      fireAlarm({
        morningRoast: false,
        wakeSpeech: KAREN_ALARM_WAKE_LINE,
        rage: readKarenAlarmRage(),
      });
    };

    tick();
    const id = window.setInterval(tick, ALARM_POLL_MS);
    return () => window.clearInterval(id);
  }, [fireAlarm]);

  // Capacitor: notification delivered / tapped while app closed → same modal.
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | null = null;
    let cancelled = false;

    void (async () => {
      const h = await attachKarenNativeAlarmListener((payload) => {
        if (cancelled) return;
        fireAlarm({
          morningRoast: payload.morningRoast,
          wakeSpeech: payload.wakeSpeech,
          rage: readKarenAlarmRage(),
        });
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
  }, [fireAlarm]);

  const onDismissed = useCallback(() => {
    stopKarenSpeech();
    setOpen(false);
  }, []);

  return (
    <KarenAlarmDismissal
      open={open}
      rage={rage}
      line={line}
      onDismissed={onDismissed}
    />
  );
}
