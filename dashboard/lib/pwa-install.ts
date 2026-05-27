export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

type NavigatorWithInstall = Navigator & {
  install?: () => Promise<void>;
};

export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
}

export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isExtensionInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.__buddyExtensionInstalled === true;
}

export function supportsWebInstallApi(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof (navigator as NavigatorWithInstall).install === "function";
}

export async function installPwa(options: {
  deferredPrompt?: BeforeInstallPromptEvent | null;
}): Promise<"installed" | "prompted" | "ios-manual" | "unavailable"> {
  const navInstall = (navigator as NavigatorWithInstall).install;
  if (typeof navInstall === "function") {
    try {
      await navInstall.call(navigator);
      return "installed";
    } catch {
      /* fall through */
    }
  }

  if (options.deferredPrompt) {
    await options.deferredPrompt.prompt();
    const choice = await options.deferredPrompt.userChoice;
    return choice?.outcome === "accepted" ? "installed" : "prompted";
  }

  if (isIosSafari()) return "ios-manual";
  return "unavailable";
}

declare global {
  interface Window {
    __buddyExtensionInstalled?: boolean;
  }
}
