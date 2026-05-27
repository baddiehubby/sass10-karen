import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { buildCompanionSyncPayload } from "@/lib/companion-sync";
import { PwaOrbView } from "@/app/pwa/pwa-orb-view";

export const dynamic = "force-dynamic";

type PwaPageProps = {
  searchParams?: { key?: string };
};

export default async function PwaPage({ searchParams }: PwaPageProps) {
  const session = await getServerSession(authOptions);
  let licenseKey = searchParams?.key?.trim() || "";
  let companionName = "Buddy";
  let apiBase = "";
  let scriptUrl = "";
  let mood = "listening";

  if (session?.user?.id) {
    const payload = await buildCompanionSyncPayload(session.user.id);
    if (payload) {
      licenseKey = payload.licenseKey;
      companionName = payload.companionName;
      apiBase = payload.apiBase;
      scriptUrl = payload.widgetScriptUrl;
    }
  }

  if (!licenseKey) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0a0a1a] px-6 text-center text-white">
        <p className="text-sm text-white/60">Sign in to meet your Buddy in your pocket.</p>
        <Link
          href="/login?callbackUrl=%2Fpwa"
          className="mt-6 rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/85"
        >
          Continue with Google
        </Link>
      </main>
    );
  }

  return (
    <PwaOrbView
      companionName={companionName}
      licenseKey={licenseKey}
      scriptUrl={scriptUrl}
      apiBase={apiBase}
      mood={mood}
    />
  );
}
