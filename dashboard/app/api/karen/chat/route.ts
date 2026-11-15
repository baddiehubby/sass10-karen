import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api-json";
import { ollamaChatStream, OllamaUnavailableError } from "@/lib/karen/ollama-client";
import {
  karenSystemPrompt,
  parseKarenChatResponse,
  stripPartialKarenTag,
} from "@/lib/karen/sass10-prompt";
import {
  KAREN_FREE_MESSAGE_LIMIT,
  KAREN_VIP_UPGRADE_MESSAGE,
  karenFreeMessagesUsedToday,
  utcDayKey,
} from "@/lib/karen/vip";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().max(2000),
        }),
      )
      .max(20)
      .optional(),
  })
  .strict();

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Karen chat — Sweet demo (free, 3 msgs / UTC day) or Sarcasm 10 (VIP unlimited).
 * Streams Ollama tokens as SSE. 401/402 remain JSON for the Upgrade modal.
 */
export async function POST(req: Request) {
  const userId = await sessionUserId();
  if (!userId) {
    return noStore({ error: "Unauthorized", reply: null, mood: null }, 401);
  }

  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPremium: true,
      karenChatCount: true,
      karenChatDay: true,
    },
  });
  if (!user) {
    return noStore({ error: "Unauthorized", reply: null, mood: null }, 401);
  }

  const isPremium = Boolean(user.isPremium);
  const usedToday = karenFreeMessagesUsedToday(user);
  const day = utcDayKey();

  // Free: 3 messages per UTC day, then paywall.
  if (!isPremium && usedToday >= KAREN_FREE_MESSAGE_LIMIT) {
    return noStore(
      {
        error: KAREN_VIP_UPGRADE_MESSAGE,
        code: "KAREN_VIP_REQUIRED",
        reply: null,
        mood: null,
        isPremium: false,
      },
      402,
    );
  }

  const { message, history = [] } = parsed.data;

  const messages = [
    { role: "system" as const, content: karenSystemPrompt(isPremium) },
    ...history.map((h) => ({
      role: h.role,
      content: h.content,
    })),
    { role: "user" as const, content: message },
  ];

  const encoder = new TextEncoder();
  let rawFull = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(sse(payload)));
      };

      try {
        send({
          type: "meta",
          isPremium,
          remainingFree: isPremium
            ? null
            : Math.max(0, KAREN_FREE_MESSAGE_LIMIT - usedToday),
        });

        await ollamaChatStream(
          { messages, signal: req.signal },
          {
            onToken: (token) => {
              rawFull += token;
              const partial = stripPartialKarenTag(rawFull);
              send({
                type: "token",
                token,
                reply: partial.reply,
                mood: partial.mood,
              });
            },
          },
        );

        const { reply, mood } = parseKarenChatResponse(rawFull, { isPremium });

        if (!isPremium) {
          // Reset counter on new UTC day; otherwise increment.
          await prisma.user.update({
            where: { id: userId },
            data:
              user.karenChatDay === day
                ? { karenChatCount: { increment: 1 } }
                : { karenChatDay: day, karenChatCount: 1 },
          });
        }

        send({ type: "done", reply, mood, isPremium });
        controller.close();
      } catch (err) {
        if (err instanceof OllamaUnavailableError) {
          send({ type: "error", error: err.message });
        } else {
          console.error("[karen/chat]", err);
          send({ type: "error", error: "Karen chat failed" });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
