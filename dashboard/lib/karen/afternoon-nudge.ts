/**
 * Hostile 2:00 PM accountability nudge — browser Notification + open-app speech.
 */

export const AFTERNOON_NUDGE_HOUR = 14;
export const AFTERNOON_NUDGE_MINUTE = 0;
export const AFTERNOON_NUDGE_LAST_KEY = "karen.afternoonNudge.lastFired";
export const AFTERNOON_NUDGE_PENDING_KEY = "karen.afternoonNudge.pendingSpeech";
export const AFTERNOON_NUDGE_QUERY = "afternoonNudge";

export const AFTERNOON_NUDGE_BODY =
  "It's 2 PM. Are you working or scrolling? I know you're scrolling.";

export const AFTERNOON_NUDGE_SPEECH = "Get back to work. Now.";

export function isAfternoonNudgeHour(now = new Date()): boolean {
  return (
    now.getHours() === AFTERNOON_NUDGE_HOUR &&
    now.getMinutes() === AFTERNOON_NUDGE_MINUTE
  );
}

export function urlRequestsAfternoonNudge(
  search: string | URLSearchParams,
): boolean {
  const params =
    typeof search === "string" ? new URLSearchParams(search.replace(/^\?/, "")) : search;
  return params.get(AFTERNOON_NUDGE_QUERY) === "1";
}

export function markAfternoonNudgePendingSpeech(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(AFTERNOON_NUDGE_PENDING_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeAfternoonNudgePendingSpeech(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const pending = window.sessionStorage.getItem(AFTERNOON_NUDGE_PENDING_KEY) === "1";
    if (pending) window.sessionStorage.removeItem(AFTERNOON_NUDGE_PENDING_KEY);
    return pending;
  } catch {
    return false;
  }
}

/**
 * Fire the 2 PM hostile notification when goals exist and evening check-in
 * is not yet completed today.
 */
export async function showAfternoonHostileNotification(opts: {
  hasGoals: boolean;
  checkInDoneToday: boolean;
}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!opts.hasGoals || opts.checkInDoneToday) return false;
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  if (!isAfternoonNudgeHour()) return false;

  const stamp = new Date().toDateString();
  try {
    if (window.localStorage.getItem(AFTERNOON_NUDGE_LAST_KEY) === stamp) return false;
    window.localStorage.setItem(AFTERNOON_NUDGE_LAST_KEY, stamp);
  } catch {
    /* ignore stamp races */
  }

  markAfternoonNudgePendingSpeech();
  const url = `/karen/dashboard?${AFTERNOON_NUDGE_QUERY}=1`;
  const notificationOpts: NotificationOptions = {
    body: AFTERNOON_NUDGE_BODY,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "karen-afternoon-nudge",
    data: { url, karenAfternoonNudge: true },
  };

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) {
      await reg.showNotification("Karen — Accountability", notificationOpts);
    } else {
      new Notification("Karen — Accountability", notificationOpts);
    }
    return true;
  } catch {
    return false;
  }
}
