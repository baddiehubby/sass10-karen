/**
 * Premium Morning Roast — local notifications at 7:00 AM (web SW + Capacitor).
 * Zero network: Notification API / LocalNotifications only.
 */

import {
  cancelKarenNativeAlarm,
  isKarenNativePlatform,
  scheduleKarenNativeAlarm,
} from "@/lib/karen/native-alarm";

export const MORNING_ROAST_HOUR = 7;
export const MORNING_ROAST_MINUTE = 0;
export const MORNING_ROAST_HHMM = "07:00";

export const MORNING_ROAST_LINE =
  "Wake up. Your dreams are dying while you sleep.";

export const MORNING_ROAST_ENABLED_KEY = "karen.morningRoast.enabled";
export const MORNING_ROAST_LAST_FIRED_KEY = "karen.morningRoast.lastFired";
export const MORNING_ROAST_PENDING_SPEECH_KEY = "karen.morningRoast.pendingSpeech";
export const MORNING_ROAST_QUERY = "morningRoast";

/** Urgent angry TTS rate for morning interruption. */
export const MORNING_ROAST_SPEECH_RATE = 1.3;

export function isMorningRoastEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MORNING_ROAST_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMorningRoastEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(MORNING_ROAST_ENABLED_KEY, "1");
    else window.localStorage.removeItem(MORNING_ROAST_ENABLED_KEY);
  } catch {
    /* private mode */
  }
}

export function markMorningRoastPendingSpeech(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(MORNING_ROAST_PENDING_SPEECH_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeMorningRoastPendingSpeech(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const pending = window.sessionStorage.getItem(MORNING_ROAST_PENDING_SPEECH_KEY) === "1";
    if (pending) window.sessionStorage.removeItem(MORNING_ROAST_PENDING_SPEECH_KEY);
    return pending;
  } catch {
    return false;
  }
}

export function urlRequestsMorningRoast(search: string | URLSearchParams): boolean {
  const params =
    typeof search === "string" ? new URLSearchParams(search.replace(/^\?/, "")) : search;
  return params.get(MORNING_ROAST_QUERY) === "1";
}

/** Register the PWA service worker (`/sw.js`) for local morning notifications. */
export async function registerKarenServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn("[morning-roast] SW register failed", err);
    return null;
  }
}

export async function requestMorningNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

function postToServiceWorker(message: Record<string, unknown>): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
    return;
  }
  void navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage(message);
  });
}

/**
 * Enable Morning Roast: permission → SW register → Capacitor or web schedule.
 */
export async function enableMorningRoast(): Promise<{ ok: boolean; detail: string }> {
  const permission = await requestMorningNotificationPermission();
  if (permission !== "granted") {
    return { ok: false, detail: "Notification permission denied." };
  }

  await registerKarenServiceWorker();
  setMorningRoastEnabled(true);
  postToServiceWorker({
    type: "KAREN_MORNING_ROAST_ENABLE",
    hour: MORNING_ROAST_HOUR,
    minute: MORNING_ROAST_MINUTE,
    body: MORNING_ROAST_LINE,
    url: `/karen/dashboard?${MORNING_ROAST_QUERY}=1`,
  });

  if (isKarenNativePlatform()) {
    const native = await scheduleKarenNativeAlarm(MORNING_ROAST_HHMM, {
      title: "Karen — Morning Roast",
      body: MORNING_ROAST_LINE,
      morningRoast: true,
      wakeSpeech: MORNING_ROAST_LINE,
    });
    return {
      ok: native.ok,
      detail: native.ok
        ? `Native morning roast armed for ${MORNING_ROAST_HHMM}.`
        : native.detail,
    };
  }

  return {
    ok: true,
    detail: "Morning Roast armed for 7:00 AM (local notification).",
  };
}

export async function disableMorningRoast(): Promise<void> {
  setMorningRoastEnabled(false);
  postToServiceWorker({ type: "KAREN_MORNING_ROAST_DISABLE" });
  if (isKarenNativePlatform()) {
    await cancelKarenNativeAlarm();
  }
}

/** Show a web Notification immediately (used by the 7 AM client tick). */
export async function showMorningRoastNotification(): Promise<void> {
  if (typeof window === "undefined" || Notification.permission !== "granted") return;

  const stamp = new Date().toDateString();
  try {
    if (window.localStorage.getItem(MORNING_ROAST_LAST_FIRED_KEY) === stamp) return;
    window.localStorage.setItem(MORNING_ROAST_LAST_FIRED_KEY, stamp);
  } catch {
    /* ignore */
  }

  markMorningRoastPendingSpeech();

  const reg = await navigator.serviceWorker?.getRegistration();
  const opts: NotificationOptions = {
    body: MORNING_ROAST_LINE,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "karen-morning-roast",
    data: { url: `/karen/dashboard?${MORNING_ROAST_QUERY}=1`, karenMorningRoast: true },
  };

  if (reg?.showNotification) {
    await reg.showNotification("Karen — Morning Roast", opts);
  } else {
    new Notification("Karen — Morning Roast", opts);
  }
}

export function isMorningRoastHour(now = new Date()): boolean {
  return now.getHours() === MORNING_ROAST_HOUR && now.getMinutes() === MORNING_ROAST_MINUTE;
}
