"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AlertEvent = {
  id: string;
  mood: string;
  timestamp: string;
  domain: string | null;
  messageSnippet: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  licenseId: string;
  licenseKeyTail: string;
};

export function AlertsFeed() {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/alerts?take=100", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load alerts");
      const data = (await res.json()) as { events: AlertEvent[] };
      setEvents(data.events || []);
    } catch (err) {
      setError("Could not refresh alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function acknowledge(eventId: string) {
    setBusyId(eventId);
    try {
      const res = await fetch("/api/alerts/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) throw new Error("Failed to acknowledge");
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
    } catch {
      setError("Acknowledge failed. Please retry.");
    } finally {
      setBusyId(null);
    }
  }

  const hasItems = useMemo(() => events.length > 0, [events.length]);

  return (
    <section className="glass-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Live sentiment alerts</h2>
        <p className="text-xs text-slate-400">Auto-refresh every 15s</p>
      </div>
      {error ? <p className="mt-3 rounded border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      {loading ? <p className="mt-4 text-sm text-slate-400">Loading alerts...</p> : null}
      {!loading && !hasItems ? (
        <p className="mt-4 text-sm text-slate-400">No unacknowledged concerning events right now.</p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm">
                  <span className="capitalize text-rose-300">{event.mood}</span>{" "}
                  <span className="text-slate-400">• {new Date(event.timestamp).toLocaleString()}</span>{" "}
                  <span className="text-slate-500">• key …{event.licenseKeyTail}</span>
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {event.messageSnippet || "No message snippet captured for this event."}
                </p>
                <p className="mt-1 text-xs text-slate-500">{event.domain || "unknown-domain"}</p>
              </div>
              <button
                type="button"
                disabled={busyId === event.id}
                onClick={() => void acknowledge(event.id)}
                className="rounded-lg border border-indigo-400/40 bg-indigo-950/40 px-3 py-2 text-xs font-medium text-indigo-100 hover:bg-indigo-900/60 disabled:opacity-60"
              >
                {busyId === event.id ? "Acknowledging..." : "Acknowledge"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
