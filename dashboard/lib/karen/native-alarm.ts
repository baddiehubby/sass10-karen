"use client";

/**
 * Native wake alarm via `@capacitor/local-notifications` (Android/iOS).
 *
 * Web apps cannot reliably wake a sleeping phone. On Capacitor Android we
 * schedule an exact alarm with `allowWhileIdle` so it fires even when the app
 * is closed / Doze is active. Tap or delivery opens the WebView and
 * `KarenAlarmWatcher` mounts the 3D dismissal challenge (looping Kokoro WAV).
 *
 * Permissions (see `android/app/src/main/AndroidManifest.xml`):
 *   SCHEDULE_EXACT_ALARM, USE_EXACT_ALARM, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED
 */

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  KAREN_ALARM_STORAGE_KEY,
  KAREN_ALARM_WAKE_LINE,
  KAREN_WAKE_QUERY,
  clearKarenAlarmTime,
  markKarenAlarmPendingWake,
  readKarenAlarmRage,
  writeKarenAlarmEnabled,
  writeKarenAlarmTime,
} from "@/lib/karen/alarm-storage";

export const KAREN_NATIVE_ALARM_ID = 191911;

/** Full wake line — also used as the looping Kokoro speech text. */
export const KAREN_WAKE_SPEECH = KAREN_ALARM_WAKE_LINE;

export function isKarenNativePlatform(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

function nextOccurrence(hhmm: string, from = new Date()): Date {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const at = new Date(from);
  at.setSeconds(0, 0);
  at.setHours(h, m, 0, 0);
  if (at.getTime() <= from.getTime() + 5_000) {
    at.setDate(at.getDate() + 1);
  }
  return at;
}

export async function ensureKarenNotificationPermission(): Promise<boolean> {
  if (!isKarenNativePlatform()) return false;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return true;
  const requested = await LocalNotifications.requestPermissions();
  return requested.display === "granted";
}

/** Exact-alarm permission (Android 12+). Opens system settings when missing. */
export async function ensureKarenExactAlarmPermission(): Promise<{
  granted: boolean;
  detail: string;
}> {
  if (!isKarenNativePlatform() || Capacitor.getPlatform() !== "android") {
    return { granted: true, detail: "Exact alarms N/A off Android." };
  }
  try {
    const current = await LocalNotifications.checkExactNotificationSetting();
    if (current.exact_alarm === "granted") {
      return { granted: true, detail: "Exact alarm permission granted." };
    }
    const next = await LocalNotifications.changeExactNotificationSetting();
    return {
      granted: next.exact_alarm === "granted",
      detail:
        next.exact_alarm === "granted"
          ? "Exact alarm permission granted."
          : "Exact alarm denied — open Alarms & reminders in system settings.",
    };
  } catch (err) {
    console.warn("[native-alarm] exact alarm check failed", err);
    return { granted: false, detail: "Could not verify exact alarm permission." };
  }
}

async function ensureKarenAlarmChannel(): Promise<void> {
  try {
    await LocalNotifications.createChannel({
      id: "karen_alarm",
      name: "Karen Alarms",
      description: "Wake-up calls from Karen — fires while the app is closed",
      importance: 5,
      visibility: 1,
      sound: undefined,
      vibration: true,
      lights: true,
      lightColor: "#e11d48",
    });
  } catch {
    /* channel may already exist */
  }
}

export type ScheduleKarenNativeAlarmOpts = {
  title?: string;
  body?: string;
  morningRoast?: boolean;
  wakeSpeech?: string;
};

/**
 * Schedule (or replace) the Karen wake local notification for HH:mm local time.
 * Persists to localStorage and, on Capacitor Android, schedules an exact
 * `LocalNotifications` alarm that survives the app being closed.
 */
export async function scheduleKarenNativeAlarm(
  hhmm: string,
  opts: ScheduleKarenNativeAlarmOpts = {},
): Promise<{ ok: boolean; detail: string }> {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) {
    return { ok: false, detail: "Invalid time" };
  }

  writeKarenAlarmTime(hhmm);
  writeKarenAlarmEnabled(true);

  if (!isKarenNativePlatform()) {
    return {
      ok: true,
      detail:
        "Saved in browser (localStorage). Install the Karen Android app for alarms that fire while closed.",
    };
  }

  const granted = await ensureKarenNotificationPermission();
  if (!granted) {
    return { ok: false, detail: "Notification permission denied." };
  }

  const exact = await ensureKarenExactAlarmPermission();
  await ensureKarenAlarmChannel();

  // Replace any prior Karen alarm notification.
  try {
    await LocalNotifications.cancel({ notifications: [{ id: KAREN_NATIVE_ALARM_ID }] });
  } catch {
    /* ignore */
  }

  const at = nextOccurrence(hhmm);
  const morningRoast = Boolean(opts.morningRoast);
  const wakeSpeech = opts.wakeSpeech || KAREN_WAKE_SPEECH;
  const openPath = `/karen?${KAREN_WAKE_QUERY}=1`;

  const result = await LocalNotifications.schedule({
    notifications: [
      {
        id: KAREN_NATIVE_ALARM_ID,
        title: opts.title || "Karen — WAKE UP",
        body: opts.body || KAREN_ALARM_WAKE_LINE,
        largeBody: KAREN_ALARM_WAKE_LINE,
        schedule: { at, allowWhileIdle: true },
        channelId: "karen_alarm",
        // Exact alarm while closed / Doze — see SCHEDULE_EXACT_ALARM in AndroidManifest.
        isExactNotification: true,
        isExactMandatory: true,
        // Heads-up + sticky until the user opens the dismissal challenge.
        foreground: true,
        ongoing: true,
        autoCancel: false,
        extra: {
          karenAlarm: true,
          morningRoast,
          time: hhmm,
          wakeSpeech,
          openPath,
          storageKey: KAREN_ALARM_STORAGE_KEY,
          rage: readKarenAlarmRage(),
        },
      },
    ],
  });

  const warning =
    result?.warning?.code != null
      ? ` Warning: exact-alarm fallback (${result.warning.code}).`
      : "";

  return {
    ok: true,
    detail: `Native exact alarm set for ${hhmm} (next: ${at.toLocaleString()}).${
      exact.granted ? "" : ` ${exact.detail}`
    }${warning}`,
  };
}

/**
 * Preferred public alias for mobile callers.
 *
 * @example
 * await scheduleKarenAlarm("07:00");
 */
export async function scheduleKarenAlarm(
  time: string,
): Promise<{ ok: boolean; detail: string }> {
  return scheduleKarenNativeAlarm(time);
}

export async function cancelKarenNativeAlarm(): Promise<void> {
  clearKarenAlarmTime();
  writeKarenAlarmEnabled(false);
  if (!isKarenNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: KAREN_NATIVE_ALARM_ID }] });
  } catch {
    /* ignore */
  }
}

export type KarenAlarmListenerHandles = {
  remove: () => Promise<void>;
};

export type KarenNativeAlarmFirePayload = {
  morningRoast: boolean;
  wakeSpeech: string;
};

function payloadFromExtra(
  extra: Record<string, unknown> | undefined,
): KarenNativeAlarmFirePayload {
  return {
    morningRoast: Boolean(extra?.morningRoast),
    wakeSpeech:
      typeof extra?.wakeSpeech === "string" && extra.wakeSpeech.trim()
        ? extra.wakeSpeech
        : KAREN_WAKE_SPEECH,
  };
}

function stashAndFire(
  onFire: (payload: KarenNativeAlarmFirePayload) => void,
  extra: Record<string, unknown> | undefined,
) {
  const payload = payloadFromExtra(extra);
  markKarenAlarmPendingWake({
    wakeSpeech: payload.wakeSpeech,
    morningRoast: payload.morningRoast,
    rage: readKarenAlarmRage(),
  });
  onFire(payload);
}

/**
 * When a Karen notification is delivered or tapped, open the wake challenge.
 * Also watches Cap App resume / launch URL for cold starts after the OS killed us.
 */
export async function attachKarenNativeAlarmListener(
  onFire: (payload: KarenNativeAlarmFirePayload) => void,
): Promise<KarenAlarmListenerHandles | null> {
  if (!isKarenNativePlatform()) return null;

  await ensureKarenAlarmChannel();

  const received = await LocalNotifications.addListener(
    "localNotificationReceived",
    (event) => {
      if (event.extra?.karenAlarm) stashAndFire(onFire, event.extra as Record<string, unknown>);
    },
  );

  const performed = await LocalNotifications.addListener(
    "localNotificationActionPerformed",
    (event) => {
      if (event.notification.extra?.karenAlarm) {
        stashAndFire(onFire, event.notification.extra as Record<string, unknown>);
      }
    },
  );

  const appState = await App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) return;
    // Cold resume — pending wake may have been stashed before React mounted.
    // Consumer in KarenAlarmWatcher also reads sessionStorage; this is a nudge.
  });

  const urlOpen = await App.addListener("appUrlOpen", (event) => {
    try {
      const url = new URL(event.url);
      if (url.searchParams.get(KAREN_WAKE_QUERY) === "1") {
        stashAndFire(onFire, {
          karenAlarm: true,
          wakeSpeech: KAREN_WAKE_SPEECH,
        });
      }
    } catch {
      /* ignore malformed */
    }
  });

  // Launch URL from notification tap that started the activity.
  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) {
      const url = new URL(launch.url);
      if (url.searchParams.get(KAREN_WAKE_QUERY) === "1") {
        stashAndFire(onFire, {
          karenAlarm: true,
          wakeSpeech: KAREN_WAKE_SPEECH,
        });
      }
    }
  } catch {
    /* ignore */
  }

  return {
    remove: async () => {
      await received.remove();
      await performed.remove();
      await appState.remove();
      await urlOpen.remove();
    },
  };
}
