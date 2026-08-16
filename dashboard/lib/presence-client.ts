"use client";

import {
  MOOD_BADGE_COLORS,
  PRESENCE_CHECK_IN_TAG,
  PRESENCE_MOOD_SYNC_TAG,
  PRESENCE_SYNC_INTERVAL_MS,
  type PresenceState,
} from "@/lib/presence-state";
import type { BuddyMood } from "@/lib/mood-detection";
import { safeGetItem, safeSetItem } from "@/lib/client-storage";

const LICENSE_STORAGE_KEY = "buddy_presence_license_key";

export function storePresenceLicenseKey(licenseKey: string) {
  if (typeof window === "undefined") return;
  safeSetItem(LICENSE_STORAGE_KEY, licenseKey.trim());
}

export function getStoredPresenceLicenseKey(): string {
  if (typeof window === "undefined") return "";
  return safeGetItem(LICENSE_STORAGE_KEY)?.trim() || "";
}

export async function fetchPresenceState(licenseKey: string): Promise<PresenceState | null> {
  const res = await fetch(`/api/presence/state?licenseKey=${encodeURIComponent(licenseKey)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function pushPresenceMood(
  licenseKey: string,
  mood: BuddyMood,
  guidanceText?: string,
): Promise<PresenceState | null> {
  const res = await fetch("/api/presence/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Buddy-License-Key": licenseKey,
    },
    body: JSON.stringify({ licenseKey, currentMood: mood, guidanceText }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data as PresenceState;
}

export async function subscribeToPush(licenseKey: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const vapidRes = await fetch("/api/presence/push/vapid-public");
  if (!vapidRes.ok) return false;
  const { publicKey } = (await vapidRes.json()) as { publicKey?: string };
  if (!publicKey) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const res = await fetch("/api/presence/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Buddy-License-Key": licenseKey,
    },
    body: JSON.stringify({
      licenseKey,
      subscription: subscription.toJSON(),
    }),
  });
  return res.ok;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

async function syncConsentToWidgetStorage(): Promise<void> {
  try {
    const res = await fetch("/api/consent", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      consents?: Array<{ purpose: string; status: string }>;
    };
    const analytics = data.consents?.find((c) => c.purpose === "anonymous_analytics");
    const granted = analytics?.status === "granted";
    safeSetItem("buddy_analytics_opt_in", granted ? "yes" : "no");
  } catch {
    /* not signed in */
  }
}

export async function registerShadowCompanion(licenseKey: string): Promise<void> {
  if (!licenseKey || !("serviceWorker" in navigator)) return;

  storePresenceLicenseKey(licenseKey);
  await syncConsentToWidgetStorage();

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  registration.active?.postMessage({
    type: "BUDDY_SET_LICENSE_KEY",
    licenseKey,
  });

  const syncRegistration = registration as ServiceWorkerRegistration & {
    sync?: { register: (tag: string) => Promise<void> };
    periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
  };

  if (syncRegistration.sync) {
    try {
      await syncRegistration.sync.register(PRESENCE_MOOD_SYNC_TAG);
    } catch {
      /* Background Sync may be unavailable */
    }
  }

  if (syncRegistration.periodicSync) {
    try {
      await syncRegistration.periodicSync.register(PRESENCE_CHECK_IN_TAG, {
        minInterval: PRESENCE_SYNC_INTERVAL_MS,
      });
    } catch {
      /* Periodic Background Sync is Chromium-only and permission-gated */
    }
  }

  void subscribeToPush(licenseKey);

  try {
    const state = await fetchPresenceState(licenseKey);
    if (state?.currentMood) {
      await updateAppBadgeForMood(state.currentMood as BuddyMood);
    }
  } catch {
    /* optional */
  }
}

function applyMoodThemeColor(color: string) {
  if (typeof document === "undefined") return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
  document.documentElement.style.setProperty("--buddy-mood-badge", color);
}

export async function updateAppBadgeForMood(mood: BuddyMood) {
  const color = MOOD_BADGE_COLORS[mood];
  applyMoodThemeColor(color);
  try {
    if ("setAppBadge" in navigator) {
      await (navigator as Navigator & { setAppBadge?: () => Promise<void> }).setAppBadge?.();
    }
    document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute("data-mood-color", color);
  } catch {
    /* ignore */
  }
}
