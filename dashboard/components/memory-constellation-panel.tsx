"use client";

import { useEffect, useState } from "react";
import {
  deleteBuddyMemory,
  discoverBuddyMemory,
  listBuddyMemories,
} from "@/lib/buddy-soul-client";
import type { PublicMemory } from "@/lib/buddy-soul-types";
import { UNIVERSE_FLAGS } from "@/lib/universe-flags";

export function MemoryConstellationPanel() {
  const [rows, setRows] = useState<PublicMemory[]>([]);
  const [available, setAvailable] = useState(false);
  const [hidden, setHidden] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const bond = await listBuddyMemories();
    if (!bond || !bond.available) {
      setAvailable(false);
      setRows([]);
      return;
    }
    setAvailable(true);
    setHidden(bond.hiddenMemories);
    setRows(bond.memories ?? []);
  }

  useEffect(() => {
    if (!UNIVERSE_FLAGS.memoryConstellation) return;
    void refresh();
  }, []);

  if (!UNIVERSE_FLAGS.memoryConstellation) return null;

  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
      <h2 className="text-sm font-medium text-white/70">Memory constellation</h2>
      <p className="mt-1 text-xs text-white/35">
        Poetic moments Buddy may hold — not a psychological profile. Delete anytime.
      </p>
      {!available ? (
        <p className="mt-4 text-xs text-white/30">
          Server memories appear when Buddy&apos;s soul tables are available. Local mood history is separate and stays on
          this device.
        </p>
      ) : (
        <>
          {hidden > 0 ? (
            <button
              type="button"
              disabled={busy}
              className="mt-4 min-h-11 rounded-full border border-white/15 px-4 text-xs text-white/70"
              onClick={() => {
                setBusy(true);
                void discoverBuddyMemory()
                  .then((bond) => {
                    if (bond?.verse) setMessage(bond.verse);
                    return refresh();
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Discover a waiting memory
            </button>
          ) : null}
          {message ? <p className="mt-3 text-sm italic text-white/60">{message}</p> : null}
          <ul className="mt-4 space-y-3 text-left text-sm text-white/55">
            {rows.length === 0 ? <li className="text-white/30">No memories yet. Showing up plants quiet ones.</li> : null}
            {rows.map((row) => (
              <li key={row.id} className="border-b border-white/5 pb-3">
                <p className={row.hidden ? "text-white/35" : "text-white/75"}>{row.verse}</p>
                <p className="mt-1 text-[11px] text-white/30">{row.orbEcho}</p>
                {!row.hidden ? (
                  <button
                    type="button"
                    className="mt-2 text-[11px] text-rose-200/60 hover:text-rose-100"
                    onClick={() => {
                      if (!window.confirm("Delete this memory permanently?")) return;
                      setBusy(true);
                      void deleteBuddyMemory(row.id)
                        .then(() => refresh())
                        .finally(() => setBusy(false));
                    }}
                  >
                    Delete
                  </button>
                ) : (
                  <span className="mt-2 inline-block text-[11px] text-white/25">Hidden until discovered</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
