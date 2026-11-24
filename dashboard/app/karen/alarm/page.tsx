import type { Metadata } from "next";
import { KarenAlarmClient } from "./karen-alarm-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Karen Alarm",
  description: "Set a Karen wake-up alarm — no snooze for excuses.",
  robots: { index: false, follow: false },
};

export default function KarenAlarmPage() {
  return <KarenAlarmClient />;
}
