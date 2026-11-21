import type { Metadata } from "next";
import { Bebas_Neue } from "next/font/google";

import { KarenLaunch } from "@/components/karen/karen-launch";
import SachaPanditPage from "@/app/sachapandit/page";
import { getTenantFromRequest } from "@/lib/tenant-request";

/** Uses headers()/cookies() via getTenantFromRequest — must not statically prerender. */
export const dynamic = "force-dynamic";

const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-karen-display",
});

export const metadata: Metadata = {
  title: {
    absolute: "Meet Karen. The Brutal Coach. | SASS10",
  },
  description:
    "She doesn't want your excuses. She wants you to fight back. Are you brave enough to win an argument against an AI?",
  openGraph: {
    title: "Meet Karen. The Brutal Coach.",
    description:
      "As seen on TikTok. No downloads — play instantly in your browser.",
  },
};

export default function HomePage() {
  const tenant = getTenantFromRequest();
  if (tenant === "sachapandit") {
    return <SachaPanditPage />;
  }

  return (
    <div className={`${display.variable} min-h-[100dvh] bg-black`}>
      {/* StartGate → Audio Preloader → /karen (iOS unlock + WAV cache) */}
      <KarenLaunch />
    </div>
  );
}
