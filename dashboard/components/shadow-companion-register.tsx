"use client";

import { useEffect } from "react";
import { registerShadowCompanion } from "@/lib/presence-client";

type ShadowCompanionRegisterProps = {
  licenseKey: string | null;
};

/** Activates PWA background sync, periodic check-in, and push when user has a license. */
export function ShadowCompanionRegister({ licenseKey }: ShadowCompanionRegisterProps) {
  useEffect(() => {
    if (!licenseKey) return;
    void registerShadowCompanion(licenseKey);
  }, [licenseKey]);

  return null;
}
