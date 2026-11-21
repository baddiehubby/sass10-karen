/**
 * Karen Wake-Up alarm — localStorage config + helpers.
 *
 * Native fallback (Android/iOS): when the Capacitor shell ships, use
 * `@capacitor/local-notifications` (see `lib/karen/native-alarm.ts`) to wake
 * the device and deep-link into this dismissal screen even if the app is closed.
 * The in-app 10s poll only works while the tab/WebView is alive.
 */

/** localStorage key for Karen wake alarm (HH:mm, 24h). */
export const KAREN_ALARM_STORAGE_KEY = "karen.alarm.time";

/** Rage intensity for the wake loop + roast escalation. */
export const KAREN_ALARM_RAGE_KEY = "karen.alarm.rage";

/** Soft enable flag — time may remain saved while alarm is off. */
export const KAREN_ALARM_ENABLED_KEY = "karen.alarm.enabled";

/** Tracks last fired minute so the alarm does not re-trigger within the same HH:mm. */
export const KAREN_ALARM_LAST_FIRED_KEY = "karen.alarm.lastFired";

/**
 * Session flag set when a Capacitor LocalNotification fires / is tapped while
 * the WebView is cold. `KarenAlarmWatcher` consumes this on boot to open the
 * 3D dismissal challenge (looping Kokoro WAV).
 */
export const KAREN_ALARM_PENDING_WAKE_KEY = "karen.alarm.pendingWake";

/** Query param / deep-link token that forces the wake modal. */
export const KAREN_WAKE_QUERY = "karenWake";

export const KAREN_ALARM_WAKE_LINE =
  "WAKE UP! GET OUT OF BED! YOU ARE WASTING YOUR LIFE!";

export const KAREN_ALARM_AWAKE_PHRASE = "I'M AWAKE";

export type KarenAlarmRage = "annoyed" | "furious" | "apocalyptic";

export const KAREN_ALARM_RAGE_OPTIONS: ReadonlyArray<{
  id: KarenAlarmRage;
  label: string;
  blurb: string;
}> = [
  { id: "annoyed", label: "Annoyed", blurb: "Petty. Persistent. Still louder than your willpower." },
  { id: "furious", label: "Furious", blurb: "Full Karen. No snooze. No mercy." },
  { id: "apocalyptic", label: "Apocalyptic", blurb: "Civilizations have ended quieter than this." },
];

export type KarenAlarmConfig = {
  time: string | null;
  enabled: boolean;
  rage: KarenAlarmRage;
};

/** Kokoro WAVs for the looping wake siren + fail-roast pool per rage. */
export const KAREN_ALARM_AUDIO: Record<
  KarenAlarmRage,
  { loop: string; loopText: string; roasts: Array<{ src: string; text: string }> }
> = {
  annoyed: {
    loop: "/audio/smackbacks/sb_11.wav",
    loopText: "I don't have all day!",
    roasts: [
      { src: "/audio/smackbacks/sb_17.wav", text: "Spit it out!" },
      { src: "/audio/smackbacks/dominance_01.wav", text: "Speak up. I don't speak coward." },
      { src: "/audio/smackbacks/sb_08.wav", text: "Weak." },
    ],
  },
  furious: {
    loop: "/audio/smackbacks/volume_interrupt.wav",
    loopText: KAREN_ALARM_WAKE_LINE,
    roasts: [
      { src: "/audio/smackbacks/sb_28.wav", text: "That is not yelling. Try again." },
      { src: "/audio/smackbacks/dominance_02.wav", text: "Is that all you've got? Pathetic." },
      { src: "/audio/smackbacks/angry_03.wav", text: "GET UP." },
    ],
  },
  apocalyptic: {
    loop: "/audio/smackbacks/angry_01.wav",
    loopText: "WAKE UP. YOUR LIFE IS ON FIRE.",
    roasts: [
      { src: "/audio/smackbacks/angry_05.wav", text: "Still in bed? Disgusting." },
      { src: "/audio/smackbacks/volume_interrupt.wav", text: "DON'T YOU DARE GO BACK TO SLEEP!" },
      { src: "/audio/smackbacks/dominance_02.wav", text: "Is that all you've got? Pathetic." },
      { src: "/audio/smackbacks/sb_15.wav", text: "Idiot." },
    ],
  },
};

/** Base loop gain by rage (0–1). Failures ramp upward from here. */
export const KAREN_ALARM_BASE_VOLUME: Record<KarenAlarmRage, number> = {
  annoyed: 0.72,
  furious: 0.88,
  apocalyptic: 1,
};

export function isKarenAlarmRage(value: unknown): value is KarenAlarmRage {
  return value === "annoyed" || value === "furious" || value === "apocalyptic";
}

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
  window.localStorage.removeItem(KAREN_ALARM_ENABLED_KEY);
}

export function readKarenAlarmRage(): KarenAlarmRage {
  if (typeof window === "undefined") return "furious";
  try {
    const raw = window.localStorage.getItem(KAREN_ALARM_RAGE_KEY);
    return isKarenAlarmRage(raw) ? raw : "furious";
  } catch {
    return "furious";
  }
}

export function writeKarenAlarmRage(rage: KarenAlarmRage): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KAREN_ALARM_RAGE_KEY, rage);
}

export function readKarenAlarmEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const flag = window.localStorage.getItem(KAREN_ALARM_ENABLED_KEY);
    if (flag === "0") return false;
    if (flag === "1") return true;
    // Legacy: time saved without enable flag → treat as on.
    return readKarenAlarmTime() != null;
  } catch {
    return false;
  }
}

export function writeKarenAlarmEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KAREN_ALARM_ENABLED_KEY, on ? "1" : "0");
}

export function readKarenAlarmConfig(): KarenAlarmConfig {
  return {
    time: readKarenAlarmTime(),
    enabled: readKarenAlarmEnabled(),
    rage: readKarenAlarmRage(),
  };
}

export function saveKarenAlarmConfig(opts: {
  time: string;
  rage: KarenAlarmRage;
  enabled?: boolean;
}): void {
  writeKarenAlarmTime(opts.time);
  writeKarenAlarmRage(opts.rage);
  writeKarenAlarmEnabled(opts.enabled ?? true);
}

/** Current local time as HH:mm */
export function currentLocalHHmm(date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Stamp used to dedupe fires within the same local minute. */
export function karenAlarmFireStamp(hhmm: string, date = new Date()): string {
  return `${date.toDateString()} ${hhmm}`;
}

/** True when transcript is (close enough to) "I'M AWAKE". */
export function isAwakeYellTranscript(raw: string): boolean {
  const n = raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return false;
  return (
    /\bi\s*m\s*awake\b/.test(n) ||
    /\bim\s*awake\b/.test(n) ||
    /\bi\s*am\s*awake\b/.test(n) ||
    n === "awake"
  );
}

export type KarenPendingWakePayload = {
  wakeSpeech: string;
  morningRoast?: boolean;
  rage?: KarenAlarmRage;
  at: number;
};

export function markKarenAlarmPendingWake(
  payload: Omit<KarenPendingWakePayload, "at"> & { at?: number },
): void {
  if (typeof window === "undefined") return;
  try {
    const body: KarenPendingWakePayload = {
      wakeSpeech: payload.wakeSpeech || KAREN_ALARM_WAKE_LINE,
      morningRoast: Boolean(payload.morningRoast),
      rage: payload.rage,
      at: payload.at ?? Date.now(),
    };
    window.sessionStorage.setItem(KAREN_ALARM_PENDING_WAKE_KEY, JSON.stringify(body));
  } catch {
    /* ignore */
  }
}

export function consumeKarenAlarmPendingWake(): KarenPendingWakePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KAREN_ALARM_PENDING_WAKE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KAREN_ALARM_PENDING_WAKE_KEY);
    const parsed = JSON.parse(raw) as Partial<KarenPendingWakePayload>;
    if (!parsed || typeof parsed.wakeSpeech !== "string") return null;
    return {
      wakeSpeech: parsed.wakeSpeech,
      morningRoast: Boolean(parsed.morningRoast),
      rage: isKarenAlarmRage(parsed.rage) ? parsed.rage : undefined,
      at: typeof parsed.at === "number" ? parsed.at : Date.now(),
    };
  } catch {
    return null;
  }
}

/** Simple no-snooze math challenge (solved while Karen keeps screaming). */
export function makeWakeMathChallenge(rand: () => number = Math.random): {
  a: number;
  b: number;
  answer: number;
  prompt: string;
} {
  const a = 8 + Math.floor(rand() * 22);
  const b = 6 + Math.floor(rand() * 24);
  return { a, b, answer: a + b, prompt: `${a} + ${b}` };
}
