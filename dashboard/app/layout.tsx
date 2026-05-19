import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppSessionProvider } from "@/components/session-provider";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "react-hot-toast";
import Link from "next/link";
import Script from "next/script";
import { CookieBanner } from "@/components/CookieBanner";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const widgetScriptUrl = getWidgetScriptUrl();

  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
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
          <Script
            src={widgetScriptUrl}
            data-hq-key="DEMO-FREE-LICENSE"
            data-hq-api={process.env.NEXTAUTH_URL || "http://localhost:3000"}
            strategy="afterInteractive"
          />
          <SiteHeader />
          <Toaster position="top-right" />
          <div className="flex-1">{children}</div>
          <footer className="mt-16 border-t border-white/10 py-6">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-sm text-slate-400">
              <p>© {new Date().getFullYear()} Buddie AI</p>
              <div className="flex items-center gap-4">
                <Link href="/trust-center" className="hover:text-white">
                  Trust Center
                </Link>
                <Link href="/eu-ai-act" className="hover:text-white">
                  EU AI Act
                </Link>
                <Link href="/gdpr" className="hover:text-white">
                  GDPR
                </Link>
                <Link href="/privacy" className="hover:text-white">
                  Privacy
                </Link>
                <Link href="/terms" className="hover:text-white">
                  Terms
                </Link>
              </div>
            </div>
          </footer>
          <CookieBanner />
        </AppSessionProvider>
      </body>
    </html>
  );
}
