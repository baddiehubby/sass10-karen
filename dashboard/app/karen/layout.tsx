import type { Metadata, Viewport } from "next";

import { ComedyDisclaimerGate } from "@/components/karen/comedy-disclaimer-gate";
import { KarenBodyLock } from "@/components/karen/karen-body-lock";

/**
 * Standalone Karen shell — no Buddie sidebar, header, footer, or branding chrome.
 * Root `SiteChrome` is skipped for /karen (middleware `x-karen-shell` + SiteChrome guard).
 * Comedy disclaimer is unskippable on first visit (Google Play abusive-AI policy).
 */
export const metadata: Metadata = {
  title: {
    absolute: "SASS10: The Brutal Coach",
  },
  description: "9 free questions. Progressive fury. Full-screen interrogation — no Buddie chrome.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SASS10",
  },
  icons: {
    apple: [
      {
        url: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
  robots: { index: false, follow: false },
  openGraph: {
    title: "SASS10: The Brutal Coach",
    description: "Full-screen roast interrogation.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Android Chrome 108+/Firefox: shrink the LAYOUT viewport when the keyboard opens
  // (default is to overlay it), so the chat input sits above the keyboard.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#000000" },
    { media: "(prefers-color-scheme: dark)", color: "#ff2d55" },
  ],
};

export default function KarenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="karen-vh relative w-screen overflow-hidden bg-black text-white">
      <KarenBodyLock />
      <ComedyDisclaimerGate>{children}</ComedyDisclaimerGate>
    </div>
  );
}
