import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardSettingsPanel } from "@/components/dashboard-settings-panel";
import { displayPlanName, ensureFreeLicenseForUser, isLicenseActive, isPaidPlan } from "@/lib/free-license";
import { prisma } from "@/lib/prisma";
import { getWidgetScriptUrl } from "@/lib/widget-cdn";

function subscriptionStatusLabel(status: string | null, expiresAt: Date, plan: string) {
  const s = (status || "").trim().toLowerCase();
  if (plan === "free") {
    return { label: "Free forever", tone: "text-indigo-300 border-indigo-500/40 bg-indigo-500/10" };
  }
  if (expiresAt.getTime() < Date.now()) {
    return { label: "Expired", tone: "text-rose-300 border-rose-500/40 bg-rose-500/10" };
  }
  if (s === "active" || s === "on_trial") {
    return { label: "Active", tone: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" };
  }
  if (s === "past_due") return { label: "Past due", tone: "text-amber-300 border-amber-500/40 bg-amber-500/10" };
  if (s === "cancelled" || s === "expired") {
    return { label: "Cancelled", tone: "text-rose-300 border-rose-500/40 bg-rose-500/10" };
  }
  if (!s || s === "free") return { label: "Trial", tone: "text-indigo-300 border-indigo-500/40 bg-indigo-500/10" };
  return { label: s.replace(/_/g, " "), tone: "text-indigo-300 border-indigo-500/40 bg-indigo-500/10" };
}

export const dynamic = "force-dynamic";

export default async function DashboardSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  await ensureFreeLicenseForUser(session.user.id);

  const licenses = await prisma.license.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  const activePaid = licenses.find((l) => isPaidPlan(l.plan) && isLicenseActive(l)) || null;
  const freeLicense = licenses.find((l) => l.plan === "free" && isLicenseActive(l)) || null;
  const embedLicense = activePaid ?? freeLicense;
  const widgetScriptUrl = getWidgetScriptUrl();
  const embedCode = embedLicense
    ? `<script src="${widgetScriptUrl}" data-hq-key="${embedLicense.key}" async></script>`
    : "";

  const licenseRows = licenses.map((l) => {
    const sub = subscriptionStatusLabel(l.lemonSqueezySubscriptionStatus, l.expiresAt, l.plan);
    return {
      id: l.id,
      key: l.key,
      plan: l.plan,
      expiresAt: l.expiresAt.toISOString(),
      statusLabel: sub.label,
      statusTone: sub.tone,
      portalUrl: l.lemonSqueezyCustomerPortalUrl,
    };
  });

  const planLicense = activePaid ?? freeLicense ?? licenses[0];

  return (
    <DashboardSettingsPanel
      embedCode={embedCode}
      hasLicense={Boolean(embedLicense)}
      licenses={licenseRows}
      planLabel={planLicense ? displayPlanName(planLicense.plan) : "None"}
      licenseId={embedLicense?.id ?? null}
    />
  );
}
