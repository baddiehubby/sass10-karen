/**
 * Browser Speech-to-Text for "Beg for Forgiveness".
 * Forces physical voice apology — psychological retention hook.
 */

export type PleadResult =
  | { ok: true; transcript: string }
  | { ok: false; reason: "unsupported" | "denied" | "no-speech" | "aborted" | "error"; detail?: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isPleadSupported(): boolean {
  return getSpeechRecognitionCtor() != null;
}

/**
 * Listen once for an apology. Resolves when recognition ends or errors.
 */
export function listenForApology(opts: {
  lang?: string;
  timeoutMs?: number;
} = {}): Promise<PleadResult> {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return Promise.resolve({ ok: false, reason: "unsupported" });

  const timeoutMs = opts.timeoutMs ?? 10_000;

  return new Promise((resolve) => {
    let settled = false;
    let transcript = "";
    const rec = new Ctor();
    rec.lang = opts.lang ?? "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    const finish = (result: PleadResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.abort();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const timer = window.setTimeout(() => {
      if (transcript.trim()) {
        finish({ ok: true, transcript: transcript.trim() });
      } else {
        finish({ ok: false, reason: "no-speech", detail: "timed out" });
      }
    }, timeoutMs);

    rec.onresult = (ev) => {
      let text = "";
      for (let i = 0; i < ev.results.length; i++) {
        const row = ev.results[i];
        const piece = row?.[0]?.transcript ?? "";
        text += piece;
      }
      transcript = text;
    };

    rec.onerror = (ev) => {
      const err = (ev.error || "error").toLowerCase();
      if (err === "not-allowed" || err === "service-not-allowed") {
        finish({ ok: false, reason: "denied", detail: err });
        return;
      }
      if (err === "no-speech") {
        finish({ ok: false, reason: "no-speech", detail: err });
        return;
      }
      if (err === "aborted") {
        finish({ ok: false, reason: "aborted", detail: err });
        return;
      }
      finish({ ok: false, reason: "error", detail: err });
    };

    rec.onend = () => {
      if (transcript.trim()) {
        finish({ ok: true, transcript: transcript.trim() });
      } else if (!settled) {
        finish({ ok: false, reason: "no-speech" });
      }
    };

    try {
      rec.start();
    } catch (err) {
      finish({
        ok: false,
        reason: "error",
        detail: err instanceof Error ? err.message : "start failed",
      });
    }
  });
}
