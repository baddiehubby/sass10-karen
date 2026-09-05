"use client";

import { useMemo, useState } from "react";

type MobileConnectClientProps = {
  codeChallenge: string;
  state: string;
  devicePublicKey: string;
};

export function MobileConnectClient({
  codeChallenge,
  state,
  devicePublicKey,
}: MobileConnectClientProps) {
  const [status, setStatus] = useState<"idle" | "connecting" | "error">("idle");
  const [message, setMessage] = useState("");

  const requestLooksValid = useMemo(
    () =>
      /^[A-Za-z0-9_-]{43}$/.test(codeChallenge) &&
      /^[A-Za-z0-9_-]{32,128}$/.test(state) &&
      /^[A-Za-z0-9_-]{80,256}$/.test(devicePublicKey),
    [codeChallenge, devicePublicKey, state],
  );

  const connect = async () => {
    if (!requestLooksValid || status === "connecting") return;
    setStatus("connecting");
    setMessage("");

    try {
      const response = await fetch("/api/companion/sync/mobile-handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ codeChallenge, state, devicePublicKey }),
      });
      const data = (await response.json().catch(() => null)) as
        | { code?: string; error?: string }
        | null;
      if (!response.ok || !data?.code) {
        throw new Error(data?.error || "Unable to connect Buddie");
      }

      // The two-minute code is PKCE- and hardware-key-bound. It is placed in
      // the fragment so browsers do not send it to another HTTP server.
      window.location.assign(
        `buddieai://auth#code=${encodeURIComponent(data.code)}&state=${encodeURIComponent(state)}`,
      );
    } catch {
      setStatus("error");
      setMessage("Buddie could not connect securely. Return to the app and try again.");
    }
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[0.22em] text-violet-200/70">Buddie Android</p>
      <h1 className="mt-4 text-3xl font-semibold text-white">Bring Buddie with you</h1>
      <p className="mt-4 text-sm leading-6 text-white/60">
        Continue to securely connect this signed-in Buddie account to your Android device.
        No password or browser cookie is shared with the app.
      </p>

      {!requestLooksValid ? (
        <p role="alert" className="mt-8 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          This connection request is invalid or expired. Return to the Buddie app and start again.
        </p>
      ) : (
        <button
          type="button"
          onClick={connect}
          disabled={status === "connecting"}
          className="mt-8 min-h-12 rounded-full bg-violet-600 px-7 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {status === "connecting" ? "Connecting securely…" : "Connect Buddie app"}
        </button>
      )}

      {message ? (
        <p role="alert" className="mt-5 text-sm text-red-200">
          {message}
        </p>
      ) : null}

      <p className="mt-8 text-xs leading-5 text-white/35">
        Only a short-lived, device-bound authorization code is returned to the app.
      </p>
    </main>
  );
}
