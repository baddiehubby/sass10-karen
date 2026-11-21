import type { Metadata } from "next";
import Link from "next/link";

import { CinematicOverlay } from "@/components/karen/cinematic-overlay";
import { FightHud } from "@/components/karen/fight-hud";
import { DevAudioLipsTestButton } from "@/components/karen/dev-audio-lips-test-button";
import { DevVipCheckoutTest } from "@/components/karen/dev-vip-checkout-test";
import { InterrogationLoader } from "@/components/karen/interrogation-loader";
import { KarenAudioUnlock } from "@/components/karen/karen-audio-unlock";
import { KarenAvatarBackdrop } from "@/components/karen/karen-avatar-backdrop";
import { KarenTensionFx } from "@/components/karen/karen-tension-fx";
import { karenFreeMessagesUsedToday, resolveKarenPremium } from "@/lib/karen/vip";
import { prisma } from "@/lib/prisma";
import { sessionUserId } from "@/lib/session-user";

export const metadata: Metadata = {
  title: {
    absolute: "Karen Knows Your Type",
  },
  description:
    "9 free questions. Progressive fury. Pay $19 for the full psychological breakdown.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Karen Roast Game — cinematic interrogation stage.
 * Layering: canvas z-0 → vignette/film z-10/15 (no pointer) → UI z-30 (auto).
 * Default mood: FURIOUS from second zero (karen-chat-client). ENTER THE ROAST
 * immediately pins browDownLeft/Right=1.0 + jawOpen=0.5 and plays the opening
 * dominance WAV ("I've been waiting for you to grow a spine. Let's go.").
 * Toxic Planner deep-link `?failedTask=` — read via client `useSearchParams`
 * (`karen-chat-client` + `InterrogationLoader`). Skips soft gate, sets FURIOUS,
 * plays `brutal_01.wav`, shows "YOU FAILED: …", fires violent Framer shake.
 * VIP Trust onboarding (first visit): soft gold/black VipTrustGate (no aggressive
 * ENTER THE ROAST), [PROUD]/[SWEET] avatar, welcome WAV ("I see potential…"),
 * glowing "VIP ACCESS GRANTED" badge, and 3 fake-premium interactions with
 * supportive goal audio before the Ambush / Faith Shatter trap.
 * Ambush (`data/interrogation.json` + `lib/karen/ambush.ts`): after the 3 soft
 * VIP Trust hits, Karen asks an open-ended trap; mic hides → text-only Send.
 * Short/excuse answers trigger Faith Shatter — FURIOUS snap, VIP badge shatter,
 * violent shake, and "VIP access revoked" audio (`brutal_01`). Then Prove Your
 * Worth Lemon paywall ($20 Savage Protocol): chat locked, 3D avatar blurred.
 * Hit FX (`FightHud` + chat stage): Dignity bar (blue, top-left) + Patience
 * (red, top-right) with Framer drain. Violent camera shake
 * `x:[0,-25,25,-20,20,-10,10,0]` / `y:[0,10,-10,10,-10,0]` @ 0.3s tween,
 * armature recoil (−0.15 rad back → forward + Z tilt), and a 100ms red flash
 * at opacity 0.4 on brutal WAVs. Shake / FURIOUS arm only when audio starts.
 * Typo / gibberish / imperfect keyword → brutal disrespect fallback (never freeze).
 *
 * Knock-Out (client `karen-chat-client.tsx` + `lib/karen/game-state.ts`):
 * - Fighters: karenPatience 0–100 vs userDignity 0–100.
 * - Hold-to-scream hit → Patience −10–15 + physical recoil; hesitate/miss → 0.
 * - Every Karen WAV → Dignity −20–25 (rigged — she hits harder; user usually loses).
 * - userDignity ≤ 0 → grayscale + giant red K.O. stamp + `ko_final` speech.
 * - karenPatience ≤ 0 (rare) → win_ko WAV + Viral Share Card.
 *
 * WebGL / TalkingHead init lives in the client `KarenAvatarBackdrop` (try/catch).
 * On failure → `use2DFallback` + `/images/karen-2d.png` + HTMLAudio combat path.
 */
export default async function KarenPage() {
  const userId = await sessionUserId();
  let userIsPremium = false;
  let initialChatCount = 0;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isPremium: true,
        karenChatCount: true,
        karenChatDay: true,
      },
    });
    userIsPremium = Boolean(user?.isPremium);
    initialChatCount = karenFreeMessagesUsedToday(user ?? {});
  }

  // Prisma `isPremium` (set by the Lemon webhook) — the dev-only VIP bypass is applied
  // inside resolveKarenPremium and is hard-off in production.
  const initialIsPremium = resolveKarenPremium(userIsPremium);

  return (
    <div
      className="karen-vh relative h-screen w-screen overflow-hidden text-white"
      style={{ background: "transparent" }}
      data-karen-interrogation=""
    >
      {/*
        Audio unlock — browsers block sound until a user gesture.
        ENTER THE ROAST (WakeKarenGate / CinematicGate) calls unlockAudio() on
        pointerdown + click. Recipe in lib/karen/voice.ts:
          AudioContext || webkitAudioContext → resume if suspended →
          silent 1-sample buffer @ 22050 Hz → destination.start(0)
        KarenAudioUnlock is a capture-phase safety net for the same unlock.
        Mic copy: MIC_PERMISSION_COPY in lib/karen/mic.ts.
      */}
      <KarenAudioUnlock />

      {/* Fixed planner tab — top right, always reachable from the fight stage */}
      <Link
        href="/karen/planner"
        className="pointer-events-auto fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 rounded-full border border-white/15 bg-black/75 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_24px_rgba(0,0,0,0.55)] backdrop-blur-md transition hover:border-[#ff2d55]/55 hover:bg-rose-950/75"
      >
        📋 PLANNER
      </Link>

      {/* z-0 — full-bleed TalkingHead canvas behind every HUD / mic layer */}
      <div className="fixed inset-0 w-screen h-screen z-0 pointer-events-none">
        <KarenAvatarBackdrop />
      </div>

      {/* z-10 — vignette must NOT block mic / quiz */}
      <div
        className="pointer-events-none fixed inset-0 z-10"
        style={{
          background:
            "radial-gradient(circle, transparent 45%, rgba(0,0,0,0.65) 100%)",
        }}
        aria-hidden
      />

      {/* Dignity (blue, top-left) + Patience (red, top-right) + hit flash / damage */}
      <FightHud />

      {/* FURIOUS red-alert wash + hang-up title card */}
      <KarenTensionFx />

      {/* Film under UI — children are also pointer-events-none */}
      <CinematicOverlay className="pointer-events-none fixed inset-0 z-[15]" />

      {/* TEMP QA — dev builds only; not shipped in production. */}
      {process.env.NODE_ENV === "development" ? <DevAudioLipsTestButton /> : null}
      {process.env.NODE_ENV === "development" ? <DevVipCheckoutTest /> : null}

      {/* z-30 — mic, quiz, chrome ABOVE every decorative overlay */}
      <div className="pointer-events-none karen-vh relative z-30 w-full bg-transparent">
        <InterrogationLoader
          initialIsPremium={initialIsPremium}
          initialChatCount={initialChatCount}
          isSignedIn={Boolean(userId)}
        />
      </div>
    </div>
  );
}
