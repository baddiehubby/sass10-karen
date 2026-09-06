"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { CHROME_EXTENSION_DOWNLOAD_URL } from "@/lib/marketing-links";
import { CopyEmbedCodeButton } from "@/components/copy-embed-code-button";
import { DashboardEmbedActions } from "@/components/dashboard-embed-actions";
import { ComplianceActions } from "@/components/compliance-actions";
import { CompanionVibeSettings } from "@/components/companion-vibe-settings";
import { ConsentManagementPanel } from "@/components/consent-management-panel";
import { displayPlanName } from "@/lib/free-license";
import { MobileDevicesPanel } from "@/components/mobile-devices-panel";

const personalities = [
  { id: "cheerful", title: "Cheerful", desc: "Bright and upbeat — great for creators." },
  { id: "calm", title: "Calm", desc: "Steady and professional — default for SaaS." },
  { id: "genius", title: "Genius", desc: "Curious analyst — ideal for complex workflows." },
] as const;

export type SettingsLicense = {
  id: string;
  key: string;
  plan: string;
  expiresAt: string;
  statusLabel: string;
  statusTone: string;
  portalUrl: string | null;
};

type DashboardSettingsPanelProps = {
  embedCode: string;
  hasLicense: boolean;
  licenses: SettingsLicense[];
  planLabel: string;
  licenseId: string | null;
};

export function DashboardSettingsPanel({
  embedCode,
  hasLicense,
  licenses,
  planLabel,
  licenseId,
}: DashboardSettingsPanelProps) {
  const [companionName, setCompanionName] = useState("");
  const [personality, setPersonality] = useState<(typeof personalities)[number]["id"]>("calm");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/onboarding/bootstrap");
      if (!res.ok) return;
      const data = (await res.json()) as { companionName?: string; personality?: string };
      if (!mounted) return;
      if (data.companionName) setCompanionName(data.companionName);
      if (data.personality === "cheerful" || data.personality === "calm" || data.personality === "genius") {
        setPersonality(data.personality);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/companion/sync", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Could not sync");
        return;
      }
      window.postMessage({ type: "BUDDY_REQUEST_EXTENSION_SYNC" }, window.location.origin);
      toast.success("Buddy synced across your devices");
    } finally {
      setSyncing(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companionName: companionName.trim() || "Buddy", personality }),
      });
      if (!res.ok) {
        toast.error("Could not save settings");
        return;
      }
      toast.success("Buddy updated");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="py-20 text-center text-sm text-white/40">Loading…</p>;
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-8 pb-20">
      <header className="text-center">
        <h1 className="text-2xl font-light text-white/90">Settings</h1>
        <p className="mt-2 text-sm text-white/40">Everything your orb needs — quietly organized.</p>
      </header>

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-white/70">Companion</h2>
            <p className="mt-1 text-xs text-white/35">Sync mood, memory, and themes on every device.</p>
          </div>
          <button
            type="button"
            onClick={() => void onSync()}
            disabled={syncing}
            className="shrink-0 rounded-full border border-violet-500/30 px-3 py-1.5 text-xs text-violet-200/90 hover:bg-violet-500/10 disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync"}
          </button>
        </div>
        <form onSubmit={onSave} className="mt-4 space-y-4">
          <input
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white"
            value={companionName}
            onChange={(e) => setCompanionName(e.target.value)}
            placeholder="Buddy"
            maxLength={60}
          />
          <div className="space-y-2">
            {personalities.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 ${
                  personality === p.id ? "border-violet-500/40 bg-violet-500/10" : "border-white/8 bg-black/20"
                }`}
              >
                <input
                  type="radio"
                  name="personality"
                  checked={personality === p.id}
                  onChange={() => setPersonality(p.id)}
                  className="mt-1"
                />
                <span>
                  <span className="text-sm text-white/85">{p.title}</span>
                  <span className="mt-0.5 block text-xs text-white/40">{p.desc}</span>
                </span>
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/80 hover:bg-white/5 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </section>

      <CompanionVibeSettings />

      <MobileDevicesPanel />

      <ConsentManagementPanel />

      <section id="embed" className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h2 className="text-sm font-medium text-white/70">Embed</h2>
        <p className="mt-1 text-xs text-white/35">One line. Copy and paste anywhere.</p>
        <div className="mt-4">
          <DashboardEmbedActions embedCode={embedCode} hasLicense={hasLicense} />
        </div>
        {hasLicense && embedCode ? (
          <div className="mt-4">
            <CopyEmbedCodeButton embedCode={embedCode} />
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <Link href="/integrations" className="text-violet-300/80 hover:text-violet-200">
            WordPress plugin →
          </Link>
          <a
            href={CHROME_EXTENSION_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-300/80 hover:text-violet-200"
          >
            Download Chrome extension (.crx) →
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h2 className="text-sm font-medium text-white/70">Plan</h2>
        <p className="mt-2 text-xl font-light capitalize text-white/90">{planLabel}</p>
        {licenses[0] ? (
          <>
            <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${licenses[0].statusTone}`}>
              {licenses[0].statusLabel}
            </span>
            <p className="mt-4 font-mono text-xs text-white/45">{licenses[0].key}</p>
            {licenses[0].portalUrl ? (
              <a href={licenses[0].portalUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-emerald-300/80">
                Customer portal →
              </a>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-white/40">No active license yet.</p>
        )}
        <Link
          href="/pricing"
          className="mt-4 inline-block rounded-full border border-violet-500/30 px-4 py-2 text-sm text-violet-200/90 hover:bg-violet-500/10"
        >
          Upgrade
        </Link>
      </section>

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h2 className="text-sm font-medium text-white/70">More</h2>
        <div className="mt-3 flex flex-col gap-2 text-sm text-white/50">
          <Link href="/dashboard/analytics" className="hover:text-white/75">
            Analytics
          </Link>
          <Link href="/dashboard/theme" className="hover:text-white/75">
            Custom themes
          </Link>
          <Link href="/dashboard/messages" className="hover:text-white/75">
            Messages
          </Link>
          <Link href="/dashboard/alerts" className="hover:text-white/75">
            Alerts
          </Link>
          <Link href="/dashboard/audit-log" className="hover:text-white/75">
            Audit log
          </Link>
          <Link href="/emotional-wellness" className="hover:text-white/75">
            Emotional wellness
          </Link>
        </div>
        <div className="mt-4">
          <ComplianceActions licenseId={licenseId} />
        </div>
      </section>

      {licenses.length > 1 ? (
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <h2 className="text-sm font-medium text-white/70">All licenses</h2>
          <ul className="mt-3 space-y-2 text-xs text-white/45">
            {licenses.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 border-b border-white/5 pb-2">
                <span>{displayPlanName(l.plan)}</span>
                <span className="font-mono">{l.key.slice(-12)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
