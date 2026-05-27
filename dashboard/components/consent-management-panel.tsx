"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { EIDATA_NEVER_COLLECT, EIDATA_POLICY_VERSION, REGULATORY_FRAMEWORKS } from "@/lib/eidata-compliance";

type ConsentRow = {
  purpose: string;
  status: "granted" | "denied" | "withdrawn";
  title: string;
  description: string;
  regulations: string[];
};

export function ConsentManagementPanel() {
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/consent");
    if (!res.ok) {
      toast.error("Could not load consent preferences");
      return;
    }
    const data = (await res.json()) as { consents: ConsentRow[] };
    setRows(data.consents || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setStatus(purpose: string, status: ConsentRow["status"]) {
    setRows((prev) => prev.map((r) => (r.purpose === purpose ? { ...r, status } : r)));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consents: rows.map((r) => ({ purpose: r.purpose, status: r.status })),
        }),
      });
      if (!res.ok) {
        toast.error("Could not save consent preferences");
        return;
      }
      toast.success("Privacy preferences saved");
      try {
        const analytics = rows.find((r) => r.purpose === "anonymous_analytics");
        if (analytics?.status === "granted") {
          window.localStorage.setItem("buddy_analytics_opt_in", "yes");
        } else {
          window.localStorage.setItem("buddy_analytics_opt_in", "no");
        }
      } catch {
        /* ignore */
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-white/45">Loading privacy controls…</p>;
  }

  return (
    <section className="luxury-card space-y-5 rounded-2xl border border-white/10 p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-violet-300/70">Emotional Intelligence Data Layer</p>
        <h2 className="mt-1 text-lg font-medium text-white/90">Granular consent</h2>
        <p className="mt-2 text-sm font-light text-white/50">
          Policy v{EIDATA_POLICY_VERSION}. Each purpose is independent — withdraw any time. We never store raw
          conversation text.
        </p>
      </div>

      <ul className="space-y-3 text-xs text-rose-200/80">
        {EIDATA_NEVER_COLLECT.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden>✕</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-4">
        {rows.map((row) => (
          <article
            key={row.purpose}
            className="rounded-xl border border-white/8 bg-black/20 p-4 text-left"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-white/85">{row.title}</h3>
                <p className="mt-1 text-xs font-light text-white/50">{row.description}</p>
                <p className="mt-2 text-[10px] text-white/35">{row.regulations.join(" · ")}</p>
              </div>
              <select
                value={row.status}
                onChange={(e) => setStatus(row.purpose, e.target.value as ConsentRow["status"])}
                className="rounded-lg border border-white/15 bg-slate-900/80 px-2 py-1.5 text-xs text-white/90"
                aria-label={`Consent for ${row.title}`}
              >
                <option value="denied">Denied</option>
                <option value="granted">Granted</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
          </article>
        ))}
      </div>

      <details className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-xs text-white/45">
        <summary className="cursor-pointer text-white/60">Regulatory frameworks</summary>
        <ul className="mt-3 space-y-2">
          {REGULATORY_FRAMEWORKS.map((f) => (
            <li key={f.id}>
              <span className="font-medium text-white/70">{f.name}</span> — {f.summary}
            </li>
          ))}
        </ul>
      </details>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="w-full rounded-full border border-violet-400/30 bg-violet-600/30 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save privacy preferences"}
      </button>
    </section>
  );
}
