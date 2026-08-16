import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BuddieOnboardingExperience } from "@/components/buddie-onboarding-experience";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/onboarding");

  const userId = session.user.id;
  if (!userId) redirect("/login?callbackUrl=/onboarding");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companionName: true, onboardingCompleted: true },
  });

  if (user?.onboardingCompleted) {
    redirect("/dashboard");
  }

  return (
    <BuddieOnboardingExperience
      defaultName={user?.companionName?.trim() || "Buddie"}
      alreadyComplete={Boolean(user?.onboardingCompleted)}
    />
  );
}
