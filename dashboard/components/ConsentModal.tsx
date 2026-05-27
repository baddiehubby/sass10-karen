"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

type ConsentModalProps = {
  /** When true, user cannot navigate away until Accept or Decline. */
  blocking?: boolean;
};

export function ConsentModal({ blocking = true }: ConsentModalProps) {
  const router = useRouter();
  const [companionMood, setCompanionMood] = useState(false);
  const [anonymousAnalytics, setAnonymousAnalytics] = useState(false);
  const [modelTraining, setModelTraining] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(mode: "accept" | "decline") {
    setSubmitting(true);
    try {
      const consents =
        mode === "decline"
          ? [
              { purpose: "companion_mood_detection", status: "denied" as const },
              { purpose: "anonymous_analytics", status: "denied" as const },
              { purpose: "model_training", status: "denied" as const },
            ]
          : [
              {
                purpose: "companion_mood_detection",
                status: (companionMood ? "granted" : "denied") as "granted" | "denied",
              },
              {
                purpose: "anonymous_analytics",
                status: (anonymousAnalytics ? "granted" : "denied") as "granted" | "denied",
              },
              {
                purpose: "model_training",
                status: (modelTraining ? "granted" : "denied") as "granted" | "denied",
              },
            ];

      if (mode === "accept" && !companionMood) {
        toast.error("Companion Mood Detection is required to use Buddie AI.");
        return;
      }

      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consents, complete: true }),
      });
      if (!res.ok) {
        toast.error("Could not save your choices");
        return;
      }

      try {
        window.localStorage.setItem(
          "buddy_analytics_opt_in",
          anonymousAnalytics && mode === "accept" ? "yes" : "no",
        );
        window.localStorage.setItem(
          "buddy_server_anonymous_analytics",
          anonymousAnalytics && mode === "accept" ? "granted" : "denied",
        );
      } catch {
        /* ignore */
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      onKeyDown={(e) => {
        if (blocking && e.key === "Escape") e.preventDefault();
      }}
    >
      <div className="luxury-card w-full max-w-lg rounded-2xl border border-violet-500/25 p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.22em] text-violet-300/80">Privacy first</p>
        <h1 id="consent-title" className="mt-2 text-xl font-medium text-white">
          How should Buddy use your emotional data?
        </h1>
        <p className="mt-2 text-sm font-light text-white/55">
          Mood is detected on your device. Raw conversations never leave your device. Choose what may be stored as
          anonymized labels only.
        </p>

        <ul className="mt-6 space-y-4 text-left">
          <ConsentToggle
            id="companion_mood"
            required
            checked={companionMood}
            onChange={setCompanionMood}
            title="Companion Mood Detection"
            description="Store mood labels on your dashboard timeline (linked to your account). Required for the full companion experience."
          />
          <ConsentToggle
            id="anonymous_analytics"
            checked={anonymousAnalytics}
            onChange={setAnonymousAnalytics}
            title="Anonymous Analytics"
            description="Share irreversible hashed mood labels to improve Buddy for everyone. Optional."
          />
          <ConsentToggle
            id="model_training"
            checked={modelTraining}
            onChange={setModelTraining}
            title="Model Training"
            description="Use anonymized mood sequences to improve mood detection. Optional. Never includes chat text."
          />
        </ul>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit("decline")}
            className="rounded-full border border-white/20 bg-black/30 py-3 text-sm font-medium text-white/85 hover:bg-white/5 disabled:opacity-50"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit("accept")}
            className="rounded-full border border-violet-400/40 bg-violet-600/35 py-3 text-sm font-medium text-white hover:bg-violet-600/50 disabled:opacity-50"
          >
            Accept
          </button>
        </div>
        <p className="mt-4 text-center text-[10px] text-white/35">
          You must choose Accept or Decline to continue. Withdraw anytime in Settings.
        </p>
      </div>
    </div>
  );
}

function ConsentToggle({
  id,
  title,
  description,
  checked,
  onChange,
  required,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-white/10 bg-black/25 p-4">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-violet-500"
      />
      <label htmlFor={id} className="cursor-pointer">
        <span className="text-sm font-medium text-white/90">
          {title}
          {required ? <span className="ml-1 text-rose-300/90">*</span> : null}
        </span>
        <span className="mt-1 block text-xs font-light text-white/50">{description}</span>
      </label>
    </li>
  );
}
