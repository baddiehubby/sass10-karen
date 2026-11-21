"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cancelKarenNativeAlarm,
  isKarenNativePlatform,
  scheduleKarenAlarm,
} from "@/lib/karen/native-alarm";
import {
  readKarenAlarmConfig,
  saveKarenAlarmConfig,
  type KarenAlarmRage,
  writeKarenAlarmEnabled,
} from "@/lib/karen/alarm-storage";

export type UseNativeAlarmResult = {
  /** Current HH:mm (local) or empty. */
  time: string;
  setTime: (hhmm: string) => void;
  rage: KarenAlarmRage;
  setRage: (rage: KarenAlarmRage) => void;
  /** True when running inside Capacitor Android/iOS. */
  isNative: boolean;
  scheduling: boolean;
  lastDetail: string | null;
  /** Schedule / replace the wake notification for `time`. */
  schedule: () => Promise<boolean>;
  /** Cancel native notification + clear stored time. */
  cancel: () => Promise<void>;
};

/**
 * Schedules Karen's wake-up as a Capacitor Local Notification.
 * Bypasses browser background restrictions on Android / iOS.
 *
 * @example
 * const { time, setTime, schedule, isNative } = useNativeAlarm("07:00");
 */
export function useNativeAlarm(initialTime = "07:00"): UseNativeAlarmResult {
  const [time, setTime] = useState(initialTime);
  const [rage, setRage] = useState<KarenAlarmRage>("furious");
  const [scheduling, setScheduling] = useState(false);
  const [lastDetail, setLastDetail] = useState<string | null>(null);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(isKarenNativePlatform());
    const cfg = readKarenAlarmConfig();
    if (cfg.time) setTime(cfg.time);
    setRage(cfg.rage);
  }, []);

  const schedule = useCallback(async () => {
    setScheduling(true);
    try {
      saveKarenAlarmConfig({ time, rage, enabled: true });
      const result = await scheduleKarenAlarm(time);
      setLastDetail(result.detail);
      return result.ok;
    } finally {
      setScheduling(false);
    }
  }, [rage, time]);

  const cancel = useCallback(async () => {
    setScheduling(true);
    try {
      await cancelKarenNativeAlarm();
      writeKarenAlarmEnabled(false);
      setLastDetail("Alarm cleared.");
    } finally {
      setScheduling(false);
    }
  }, []);

  return { time, setTime, rage, setRage, isNative, scheduling, lastDetail, schedule, cancel };
}
