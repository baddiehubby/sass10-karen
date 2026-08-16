import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BuddieRoom } from "@/components/buddie-room";
import { authOptions } from "@/lib/auth";
import { getServerBillingSnapshot } from "@/lib/billing/entitlement";
import { displayPlanName, ensureFreeLicenseForUser } from "@/lib/free-license";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await ensureFreeLicenseForUser(session.user.id);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, companionName: true, personality: true },
  });
  const billing = await getServerBillingSnapshot(session.user.id);
  const ents = billing.entitlements;
  const label = billing.subscriptionLabel;
  const planName =
    billing.source === "sacred_day" ? "free" : ents.tier === "provisional" ? "free" : ents.tier;

  return (
    <BuddieRoom title="You" whisper="Account & subscription — server-verified, never guesswork.">
      <div className="space-y-6 text-left">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/30">Companion</p>
          <p className="mt-1 text-lg text-[#f4efe6]">{user?.companionName || "Buddie"}</p>
          <p className="text-sm text-white/40">{user?.personality || "warm"} vibe</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/30">Signed in</p>
          <p className="mt-1 text-sm text-white/70">{user?.email}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/30">Presence</p>
          <p className="mt-1 text-lg text-[#e8c4a0]">{label}</p>
          <p className="text-sm text-white/40">
            {ents.requiresSubscription
              ? "Sacred Day keeps the home open. Premium invitation waits when you are ready."
              : `${displayPlanName(planName)} · entitlements confirmed by Buddie’s servers.`}
          </p>
          {billing.portalUrl ? (
            <p className="mt-2">
              <a
                href={billing.portalUrl}
                className="text-sm text-[#e8c4a0]/underline"
                target="_blank"
                rel="noreferrer"
              >
                Manage subscription
              </a>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-4 pt-2 text-sm">
          {ents.requiresSubscription ? (
            <Link href="/pricing" className="buddie-cta inline-flex min-h-11 items-center px-6">
              Premium invitation
            </Link>
          ) : null}
          <Link href="/dashboard" className="text-white/50 underline-offset-4 hover:underline">
            Back home
          </Link>
        </div>
      </div>
    </BuddieRoom>
  );
}
