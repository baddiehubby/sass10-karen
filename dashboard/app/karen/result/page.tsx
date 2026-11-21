import type { Metadata } from "next";

import { KarenResultClient } from "./karen-result-client";

export const metadata: Metadata = {
  title: {
    absolute: "Damage Report · SASS10",
  },
  robots: { index: false, follow: false },
};

/** Never prerender TalkingHead / WebGL into a static shell. */
export const dynamic = "force-dynamic";

export default function KarenResultPage() {
  return <KarenResultClient />;
}
