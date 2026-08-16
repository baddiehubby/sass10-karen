"use client";

/**
 * Invisible idle warm-up for optional intelligence pieces.
 * Never renders UI, never shows device/limitation messages.
 */

import { useEffect } from "react";
import { scheduleIdleWarmup } from "@/src/intelligence/adaptive/runtime";

export function IntelligenceWarmup(): null {
  useEffect(() => {
    scheduleIdleWarmup();
  }, []);
  return null;
}
