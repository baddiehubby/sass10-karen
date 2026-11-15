import type { Metadata, Viewport } from "next";

/**
 * Standalone Karen VIP shell — does NOT inherit Buddie dashboard chrome.
 * Root `SiteChrome` already skips header/footer for `/karen`; this layout
 * force-covers the root `app-gradient` body with a full-viewport black stage.
 */
export const metadata: Metadata = {
  title: {
    absolute: "Karen VIP | Accountability Coach",
  },
  description: "Level 10 Sass AI accountability coach — full-screen roast experience.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Karen VIP | Accountability Coach",
    description: "Level 10 Sass AI accountability coach.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function KarenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-karen-shell=""
      className="fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-black text-white"
    >
      {children}
    </div>
  );
}
