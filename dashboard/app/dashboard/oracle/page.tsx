import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { OracleClient } from "@/components/oracle-client";
import { authOptions } from "@/lib/auth";
import { getUserEntitlement } from "@/lib/billing/entitlement";
import { ensureFreeLicenseForUser } from "@/lib/free-license";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Oracle Realm",
  description: "AI-powered reflection and entertainment. Not fate, medicine, or religion.",
};

export default async function OraclePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  let userId = session.user.id;
  if (!userId && session.user.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true },
    });
    userId = byEmail?.id ?? "";
  }
  if (!userId) redirect("/login");

  await ensureFreeLicenseForUser(userId);
  const entitlement = await getUserEntitlement(userId);

  return (
    <OracleClient
      advancedOracle={entitlement.entitlements.advancedOracle}
      tierLabel={entitlement.entitlements.label}
    />
  );
}
