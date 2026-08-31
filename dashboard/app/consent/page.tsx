import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ConsentModal } from "@/components/ConsentModal";
import { ConsentSessionRefresh } from "@/components/consent-session-refresh";
import { authOptions } from "@/lib/auth";
import { userHasCompletedEidataConsent } from "@/lib/consent-service";

export const metadata = {
  title: "Privacy choices",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConsentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  if (session.user.eidataConsentCompleted) {
    redirect("/dashboard");
  }

  const completed = await userHasCompletedEidataConsent(session.user.id);
  if (completed) {
    return <ConsentSessionRefresh />;
  }

  return <ConsentModal blocking />;
}
