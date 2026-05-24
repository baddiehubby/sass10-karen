import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardSettingsPanel } from "@/components/dashboard-settings-panel";
import { prisma } from "@/lib/prisma";
import { getWidgetScriptUrl } from "@/lib/widget-cdn";

function planLabel(plan: string) {
  if (plan === "free") return "Expired";
  if (plan === "pro") return "Starter";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function subscriptionStatusLabel(status: string | null, expiresAt: Date) {
  const s = (status || "").trim().toLowerCase();
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

  const licenses = await prisma.license.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  const now = Date.now();
  const firstActive = licenses.find((l) => new Date(l.expiresAt).getTime() > now) || null;
  const widgetScriptUrl = getWidgetScriptUrl();
  const embedCode = firstActive
    ? `<script src="${widgetScriptUrl}" data-hq-key="${firstActive.key}" async></script>`
    : "";

  const licenseRows = licenses.map((l) => {
    const sub = subscriptionStatusLabel(l.lemonSqueezySubscriptionStatus, l.expiresAt);
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

  const planLicense = firstActive || licenses[0];

  return (
    <DashboardSettingsPanel
      embedCode={embedCode}
      hasLicense={Boolean(firstActive)}
      licenses={licenseRows}
      planLabel={planLicense ? planLabel(planLicense.plan) : "None"}
      licenseId={firstActive?.id ?? null}
    />
  );
}
