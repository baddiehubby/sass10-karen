"use client";

/**
 * Native wake alarm via Capacitor Local Notifications (Android/iOS).
 * Web apps cannot reliably wake a sleeping phone — use this on Capacitor.
 *
 * Falls back to web localStorage + in-app watcher when not on native.
 */

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  KAREN_ALARM_STORAGE_KEY,
  KAREN_ALARM_WAKE_LINE,
  clearKarenAlarmTime,
  writeKarenAlarmTime,
} from "@/lib/karen/alarm-storage";

export const KAREN_NATIVE_ALARM_ID = 191911;

/** Spoken line when the notification is tapped / delivered. */
export const KAREN_WAKE_SPEECH = "WAKE UP!";

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

async function ensureKarenAlarmChannel(): Promise<void> {
  try {
    await LocalNotifications.createChannel({
      id: "karen_alarm",
      name: "Karen Alarms",
      description: "Wake-up calls from Karen",
      importance: 5,
      visibility: 1,
      sound: undefined,
      vibration: true,
    });
  } catch {
    /* channel may already exist */
  }
}

/**
 * Schedule (or replace) the Karen wake local notification for HH:mm local time.
 * Also persists the time to localStorage for the in-app UI.
 */
export async function scheduleKarenNativeAlarm(
  hhmm: string,
): Promise<{ ok: boolean; detail: string }> {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) {
    return { ok: false, detail: "Invalid time" };
  }

  writeKarenAlarmTime(hhmm);

  if (!isKarenNativePlatform()) {
    return {
      ok: true,
      detail:
        "Saved in browser. Open the Karen app on Android for native alarms that fire while closed.",
    };
  }

  const granted = await ensureKarenNotificationPermission();
  if (!granted) {
    return { ok: false, detail: "Notification permission denied." };
  }

  await ensureKarenAlarmChannel();

  // Replace any prior Karen alarm notification.
  try {
    await LocalNotifications.cancel({ notifications: [{ id: KAREN_NATIVE_ALARM_ID }] });
  } catch {
    /* ignore */
  }

  const at = nextOccurrence(hhmm);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: KAREN_NATIVE_ALARM_ID,
        title: "Karen — WAKE UP",
        body: KAREN_ALARM_WAKE_LINE,
        schedule: { at, allowWhileIdle: true },
        channelId: "karen_alarm",
        extra: {
          karenAlarm: true,
          time: hhmm,
          wakeSpeech: KAREN_WAKE_SPEECH,
          storageKey: KAREN_ALARM_STORAGE_KEY,
        },
      },
    ],
  });

  return {
    ok: true,
    detail: `Native alarm set for ${hhmm} (next: ${at.toLocaleString()}).`,
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

/**
 * When a Karen notification is tapped / delivered, invoke callback
 * (opens app → speakWithKaren("WAKE UP!")).
 */
export async function attachKarenNativeAlarmListener(
  onFire: () => void,
): Promise<KarenAlarmListenerHandles | null> {
  if (!isKarenNativePlatform()) return null;

  await ensureKarenAlarmChannel();

  const received = await LocalNotifications.addListener(
    "localNotificationReceived",
    (event) => {
      if (event.extra?.karenAlarm) onFire();
    },
  );

  const performed = await LocalNotifications.addListener(
    "localNotificationActionPerformed",
    (event) => {
      if (event.notification.extra?.karenAlarm) onFire();
    },
  );

  return {
    remove: async () => {
      await received.remove();
      await performed.remove();
    },
  };
}
