import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { DebiopwrDashboard } from "@/components/debiopwr-dashboard";
import { authOptions } from "@/lib/auth";
import { assertDebiopwrAdmin } from "@/lib/debiopwr-admin";

export const metadata = {
  title: "Debiopwr",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DebiopwrPage() {
  const session = await getServerSession(authOptions);
  if (!assertDebiopwrAdmin(session)) redirect("/dashboard");

  return <DebiopwrDashboard apiBase="/api/debiopwr" />;
}
