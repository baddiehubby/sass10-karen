"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

const personalities = [
  { id: "cheerful", title: "Cheerful", desc: "Bright and upbeat — great for creators." },
  { id: "calm", title: "Calm", desc: "Steady and professional — default for SaaS." },
  { id: "genius", title: "Genius", desc: "Curious analyst — ideal for complex workflows." },
] as const;

export default function DashboardSettingsPage() {
  const [companionName, setCompanionName] = useState("");
  const [personality, setPersonality] = useState<(typeof personalities)[number]["id"]>("calm");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/onboarding/bootstrap");
      if (!res.ok) return;
      const data = (await res.json()) as {
        companionName?: string;
        personality?: string;
      };
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
    return <p className="text-sm text-slate-400">Loading settings…</p>;
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.24em] text-indigo-300">Settings</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Customize your Buddy</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-400">
        Set your companion&apos;s name and personality. You can change these anytime — your embed updates automatically.
      </p>

      <form onSubmit={onSave} className="mt-8 max-w-lg space-y-6 glass-panel p-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-200">Companion name</span>
          <input
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={companionName}
            onChange={(e) => setCompanionName(e.target.value)}
            placeholder="Buddy"
            maxLength={60}
          />
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-slate-200">Personality</legend>
          <div className="mt-3 space-y-2">
            {personalities.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 ${
                  personality === p.id ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/10 bg-slate-950/40"
                }`}
              >
                <input
                  type="radio"
                  name="personality"
                  value={p.id}
                  checked={personality === p.id}
                  onChange={() => setPersonality(p.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-white">{p.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{p.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <Link href="/dashboard" className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-slate-200 hover:bg-white/5">
            Back to dashboard
          </Link>
        </div>
      </form>
    </div>
  );
}
