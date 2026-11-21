"use client";

import { useEffect } from "react";

const BODY_CLASS = "karen-fullscreen overflow-hidden bg-black text-white";

/**
 * Root layout does not remount on client navigations — force the document
 * into a Buddie-free full-screen stage while any /karen route is active.
 *
 * Also owns the phone-keyboard fix: publishes the VISIBLE height as
 * `--karen-vvh` (used by `.karen-vh`) so the chat input is never hidden
 * behind the on-screen keyboard.
 *   - Android Chrome: `interactiveWidget: "resizes-content"` (karen layout) already
 *     shrinks the layout; visualViewport agrees, so both paths give the same value.
 *   - iOS Safari: ignores interactive-widget and only shrinks the VISUAL viewport,
 *     so this listener is what makes the layout follow the keyboard there.
 *   - Capacitor Android: `windowSoftInputMode=adjustResize` shrinks the WebView.
 */
export function KarenBodyLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlClass = html.className;
    const prevBodyClass = body.className;
    const prevOverflow = body.style.overflow;

    html.classList.add("karen-lock");
    body.className = BODY_CLASS;
    body.style.overflow = "hidden";
    body.dataset.karenShell = "1";

    const vv = window.visualViewport;
    const syncViewport = () => {
      // Pinch-zoomed → vv.height is the zoomed window, not the keyboard; ignore it.
      const h = vv && vv.scale <= 1.01 ? vv.height : window.innerHeight;
      html.style.setProperty("--karen-vvh", `${Math.round(h)}px`);
      // iOS pans the layout viewport to reveal a focused input even when the body
      // is overflow:hidden. Snap back so the top of the stage never drifts away.
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
    };
    syncViewport();
    vv?.addEventListener("resize", syncViewport);
    vv?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);

    return () => {
      vv?.removeEventListener("resize", syncViewport);
      vv?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      html.style.removeProperty("--karen-vvh");
      html.className = prevHtmlClass;
      body.className = prevBodyClass;
      body.style.overflow = prevOverflow;
      delete body.dataset.karenShell;
      html.classList.remove("karen-lock");
    };
  }, []);

  return null;
}
