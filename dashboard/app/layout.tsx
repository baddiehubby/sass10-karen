import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AnalyticsPixels } from "@/components/analytics-pixels";
import { InstallPrompt } from "@/components/InstallPrompt";
import { AppSessionProvider } from "@/components/session-provider";
import { SiteChrome } from "@/components/site-chrome";
import { Toaster } from "react-hot-toast";
import { getAppBaseUrl } from "@/lib/site-url";
import { getWidgetScriptUrl } from "@/lib/widget-cdn";
import "./globals.css";

/** Capacitor + Karen voice — client-only so SSR/prerender never pulls native/TTS chunks. */
const KarenAlarmWatcher = dynamic(
  () =>
    import("@/components/karen/karen-alarm-watcher").then((m) => m.KarenAlarmWatcher),
  { ssr: false },
);

const sans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const seoTitle = "Buddie AI – The Emotional Safety Layer for AI Chat (EU AI Act Ready)";
const seoDescription =
  "Protect your users and comply with the EU AI Act. Buddy AI adds emotional intelligence to any chatbot – detect harm, monitor sentiment, and build trust. Embed in 30 seconds.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.buddieai.com"),
  // PWA — emits <link rel="manifest" href="/manifest.json" />
  manifest: "/manifest.json",
  // iOS standalone — exact tags:
  //   <meta name="apple-mobile-web-app-capable" content="yes" />
  //   <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  //   <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SASS10: The Brutal Coach",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
  other: {
    // Explicit fallback for older iOS Safari that still keys on this name
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "mobile-web-app-capable": "yes",
  },
  title: {
    default: seoTitle,
    template: "%s | Buddie AI",
  },
  description: seoDescription,
  openGraph: {
    title: seoTitle,
    description: seoDescription,
    url: "https://buddieai.com",
    siteName: "Buddie AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: seoTitle,
    description: seoDescription,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Black shell + neon red chrome (Android address bar / splash)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#000000" },
    { media: "(prefers-color-scheme: dark)", color: "#ff2d55" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const widgetScriptUrl = getWidgetScriptUrl();
  const apiBase = getAppBaseUrl();
  const headerList = await headers();
  const isKarenShell = headerList.get("x-karen-shell") === "1";

  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased${isKarenShell ? " karen-lock" : ""}`}
    >
      <body
        className={
          isKarenShell
            ? "karen-fullscreen karen-vh overflow-hidden bg-black text-white"
            : "app-gradient min-h-[100dvh] min-h-full flex flex-col text-slate-100 overflow-x-hidden"
        }
        data-karen-shell={isKarenShell ? "1" : undefined}
      >
        <AnalyticsPixels />
        <AppSessionProvider>
          {isKarenShell ? (
            <>
              <KarenAlarmWatcher />
              {children}
              <InstallPrompt />
            </>
          ) : (
            <>
              <div
                className="pointer-events-none fixed -left-[10000px] top-0 w-[320px] opacity-[0.01]"
                aria-hidden
              >
                <div data-message-author-role="assistant">
                  Great work today. Users are succeeding quickly and confidence is high across this
                  onboarding flow.
                </div>
                <div data-message-author-role="assistant">
                  If anything feels broken, I will help immediately and we can fix concerns before they
                  become churn.
                </div>
              </div>
              <Toaster position="top-right" />
              <KarenAlarmWatcher />
              <noscript>
                <div className="mx-auto max-w-lg px-6 py-16 text-center text-sm text-slate-200">
                  Buddie needs JavaScript for the companion orb and check-ins. Please enable it to
                  continue.
                </div>
              </noscript>
              <Suspense fallback={<div className="flex-1">{children}</div>}>
                <SiteChrome widgetScriptUrl={widgetScriptUrl} apiBase={apiBase}>
                  {children}
                </SiteChrome>
              </Suspense>
              <InstallPrompt />
            </>
          )}
        </AppSessionProvider>
      </body>
    </html>
  );
}
