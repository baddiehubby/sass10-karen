import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { AppSessionProvider } from "@/components/session-provider";
import { SiteChrome } from "@/components/site-chrome";
import { Toaster } from "react-hot-toast";
import { getAppBaseUrl } from "@/lib/site-url";
import { getWidgetScriptUrl } from "@/lib/widget-cdn";
import "./globals.css";

const sans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const seoTitle = "Buddie AI – The Emotional Safety Layer for AI Chat (EU AI Act Ready)";
const seoDescription =
  "Protect your users and comply with the EU AI Act. Buddy AI adds emotional intelligence to any chatbot – detect harm, monitor sentiment, and build trust. Embed in 30 seconds.";

export const metadata: Metadata = {
  metadataBase: new URL("https://buddieai.com"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Buddy",
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
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const widgetScriptUrl = getWidgetScriptUrl();
  const apiBase = getAppBaseUrl();

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="app-gradient min-h-full flex flex-col text-slate-100">
        <AppSessionProvider>
          <div className="pointer-events-none fixed -left-[10000px] top-0 w-[320px] opacity-[0.01]" aria-hidden>
            <div data-message-author-role="assistant">
              Great work today. Users are succeeding quickly and confidence is high across this onboarding flow.
            </div>
            <div data-message-author-role="assistant">
              If anything feels broken, I will help immediately and we can fix concerns before they become churn.
            </div>
          </div>
          <Toaster position="top-right" />
          <Suspense fallback={<div className="flex-1">{children}</div>}>
            <SiteChrome widgetScriptUrl={widgetScriptUrl} apiBase={apiBase}>
              {children}
            </SiteChrome>
          </Suspense>
        </AppSessionProvider>
      </body>
    </html>
  );
}
