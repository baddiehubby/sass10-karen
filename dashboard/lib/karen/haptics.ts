/**
 * Mobile combat haptics — violent vibration patterns for smackbacks / rage.
 * No-ops safely on desktop / unsupported browsers.
 */

/** Violent angry pulse — smackback punch feel. */
export const HAPTIC_RAGE_PATTERN = [100, 50, 100, 50, 200] as const;

/** Shorter hit for SEND INSULT punch. */
export const HAPTIC_PUNCH_PATTERN = [40, 30, 80] as const;

function canVibrate(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  );
}

/** Fire the angry smackback vibration pattern. */
export function triggerHapticRage(
  pattern: number[] | readonly number[] = HAPTIC_RAGE_PATTERN,
): boolean {
  if (!canVibrate()) return false;
  try {
    return navigator.vibrate([...pattern]);
  } catch {
    return false;
  }
}

/** Quick punch on SEND INSULT. */
export function triggerHapticPunch(): boolean {
  return triggerHapticRage(HAPTIC_PUNCH_PATTERN);
}

/** Stop any ongoing vibration. */
export function cancelHaptics(): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(0);
  } catch {
    /* ignore */
  }
}
