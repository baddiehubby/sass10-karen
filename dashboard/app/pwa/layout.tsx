import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Buddy — Mobile Companion",
  description: "Your Sacha Pandit orb, always in your pocket.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Buddy",
    startupImage: "/apple-touch-icon.png",
  },
  icons: [
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png", sizes: "180x180" },
  ],
};

export const viewport: Viewport = {
  themeColor: "#0a0a1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function PwaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
