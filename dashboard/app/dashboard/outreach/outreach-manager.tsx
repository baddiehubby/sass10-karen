"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { OUTREACH_TEMPLATES, fillTemplate } from "@/lib/outreach-templates";

type RecentRow = { id: string; recipientEmail: string; subject: string; sentAt: string };

export function OutreachManager(props: { recent: RecentRow[] }) {
  const { recent } = props;
  const router = useRouter();
  const [templateId, setTemplateId] = useState(OUTREACH_TEMPLATES[0]?.id || "");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [pain, setPain] = useState("");
  const [loading, setLoading] = useState(false);

  const preview = useMemo(() => {
    const tpl = OUTREACH_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return { subject: "", body: "" };
    const vars = { name, company, pain_point: pain };
    return {
      subject: fillTemplate(tpl.subject, vars),
      body: fillTemplate(tpl.body, vars),
    };
  }, [templateId, name, company, pain]);

  async function send() {
    setLoading(true);
    const res = await fetch("/api/outreach/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        recipientName: name,
        company,
        recipientEmail: email,
        painPoint: pain,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      toast.error(data.error || "Send failed");
      return;
    }
    toast.success("Email queued (demo mode) – connect Resend later");
    setEmail("");
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-white">Compose</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Template
            <select
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {OUTREACH_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Recipient email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              placeholder="founder@agency.com"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Company
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
          </label>
          <label className="sm:col-span-2 flex flex-col gap-1 text-sm text-slate-300">
            Pain point / hook
            <input value={pain} onChange={(e) => setPain(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" placeholder="e.g., churn after AI launch" />
          </label>
        </div>
        <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase text-slate-500">Preview</p>
          <p className="mt-2 text-sm font-medium text-indigo-200">{preview.subject}</p>
          <pre className="mt-3 whitespace-pre-wrap font-mono text-xs text-slate-300">{preview.body}</pre>
        </div>
        <button
          type="button"
          disabled={loading || !email}
          onClick={() => void send()}
          className="mt-6 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {loading ? "Sending…" : "Send (demo queue)"}
        </button>
      </section>

      <section className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-white">Recent queue</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {recent.length === 0 ? <li className="text-slate-500">No sends yet.</li> : null}
          {recent.map((r) => (
            <li key={r.id} className="rounded border border-slate-800 bg-slate-900/50 px-3 py-2">
              <span className="text-indigo-200">{r.recipientEmail}</span> — {r.subject}{" "}
              <span className="text-slate-500">({new Date(r.sentAt).toLocaleString()})</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
