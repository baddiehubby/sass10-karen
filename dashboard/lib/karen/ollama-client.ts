/**
 * Minimal Ollama HTTP client for Karen chat.
 * Defaults match a local Ollama install (http://127.0.0.1:11434).
 */

export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OllamaChatOptions = {
  messages: OllamaChatMessage[];
  model?: string;
  baseUrl?: string;
  signal?: AbortSignal;
};

function resolveBaseUrl(explicit?: string): string {
  const raw =
    explicit?.trim() ||
    process.env.OLLAMA_BASE_URL?.trim() ||
    process.env.OLLAMA_HOST?.trim() ||
    "http://127.0.0.1:11434";
  return raw.replace(/\/$/, "");
}

function resolveModel(explicit?: string): string {
  return (
    explicit?.trim() ||
    process.env.OLLAMA_MODEL?.trim() ||
    process.env.OLLAMA_KAREN_MODEL?.trim() ||
    "llama3.2"
  );
}

export class OllamaUnavailableError extends Error {
  readonly code = "OLLAMA_UNAVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "OllamaUnavailableError";
  }
}

async function openOllamaChat(
  opts: OllamaChatOptions,
  stream: boolean,
): Promise<Response> {
  const baseUrl = resolveBaseUrl(opts.baseUrl);
  const model = resolveModel(opts.model);
  const url = `${baseUrl}/api/chat`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        stream,
        options: {
          temperature: 0.85,
          num_predict: 180,
        },
      }),
      signal: opts.signal,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new OllamaUnavailableError(
      `Cannot reach Ollama at ${baseUrl} (${detail}). Is Ollama running?`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OllamaUnavailableError(
      `Ollama error ${res.status} for model "${model}": ${body.slice(0, 240) || res.statusText}`,
    );
  }

  return res;
}

/**
 * Non-streaming chat completion via Ollama `/api/chat`.
 */
export async function ollamaChat(opts: OllamaChatOptions): Promise<string> {
  const res = await openOllamaChat(opts, false);
  const data = (await res.json()) as {
    message?: { content?: string };
    response?: string;
  };
  const content = data.message?.content ?? data.response ?? "";
  if (!content.trim()) {
    throw new OllamaUnavailableError("Ollama returned an empty response");
  }
  return content;
}

export type OllamaStreamHandlers = {
  onToken: (token: string) => void;
};

/**
 * Streaming chat via Ollama `/api/chat` with `stream: true`.
 * Invokes `onToken` for each content delta as soon as it arrives.
 */
export async function ollamaChatStream(
  opts: OllamaChatOptions,
  handlers: OllamaStreamHandlers,
): Promise<string> {
  const res = await openOllamaChat(opts, true);
  if (!res.body) {
    throw new OllamaUnavailableError("Ollama stream returned no body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;

      let parsed: {
        message?: { content?: string };
        done?: boolean;
        error?: string;
      };
      try {
        parsed = JSON.parse(line) as typeof parsed;
      } catch {
        continue;
      }
      if (parsed.error) {
        throw new OllamaUnavailableError(parsed.error);
      }
      const token = parsed.message?.content ?? "";
      if (token) {
        full += token;
        handlers.onToken(token);
      }
    }
  }

  if (!full.trim()) {
    throw new OllamaUnavailableError("Ollama stream returned an empty response");
  }
  return full;
}
