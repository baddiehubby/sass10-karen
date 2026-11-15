/** localStorage key for Karen wake alarm (HH:mm, 24h). */
export const KAREN_ALARM_STORAGE_KEY = "karen.alarm.time";

/** Tracks last fired minute so the alarm does not re-trigger within the same HH:mm. */
export const KAREN_ALARM_LAST_FIRED_KEY = "karen.alarm.lastFired";

export const KAREN_ALARM_WAKE_LINE =
  "WAKE UP! GET OUT OF BED! YOU ARE WASTING YOUR LIFE!";

export function readKarenAlarmTime(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KAREN_ALARM_STORAGE_KEY);
    if (!raw) return null;
    return /^\d{2}:\d{2}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeKarenAlarmTime(hhmm: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KAREN_ALARM_STORAGE_KEY, hhmm);
}

export function clearKarenAlarmTime(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KAREN_ALARM_STORAGE_KEY);
}

/** Current local time as HH:mm */
export function currentLocalHHmm(date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
