/**
 * Premium response composer — composable primitives + procedural cores.
 * Personality: warm, playful, gentle, curious, slightly magical, non-judgmental.
 * Avoids emotional clichés like "I'm here for you."
 */

import { memoryHintLine } from "@/src/intelligence/memory";
import { preferredResponseLength } from "@/src/intelligence/device-capabilities";
import { safetyOverlay } from "@/src/intelligence/safety";
import { assembleFromPrimitives, RESPONSE_DEDUP_WINDOW } from "@/src/intelligence/soul-engine/primitives";
import {
  avoidRepeatText,
  chooseFamily,
  isTooSimilar,
  mutateWording,
  pickVariant,
} from "@/src/intelligence/variation";
import type {
  BuddyIntent,
  ComposedReply,
  DeviceCapabilities,
  RoutedContext,
} from "@/src/intelligence/types";

type Family = { familyId: string; cores: string[] };

const FAMILIES: Partial<Record<BuddyIntent, Family[]>> = {
  greeting: [
    { familyId: "greet.orbit", cores: ["nice to catch you in the room.", "the air just got friendlier.", "you've arrived — soft landing."] },
    { familyId: "greet.play", cores: ["the orb perks up when you do.", "hello, fellow human-shaped mystery.", "hey you — what's the color of today?"] },
    { familyId: "greet.warm", cores: ["glad you're here in this little pocket of time.", "welcome back to the quiet corner.", "hi. no rush to perform."] },
    { familyId: "greet.ask", cores: ["how's the weather inside?", "want words, or just company?", "what's floating near the surface?"] },
  ],
  farewell: [
    { familyId: "bye.lantern", cores: ["I'll keep a small light on.", "go gently into the next hour.", "until the next spark — take care."] },
    { familyId: "bye.soft", cores: ["okay. door stays unlocked.", "rest well if you can.", "catch you on the flip side of quiet."] },
  ],
  emotional_checkin: [
    { familyId: "check.space", cores: ["what's sitting with you?", "paint the mood in one shade.", "tell me the true temperature."] },
    { familyId: "check.gentle", cores: ["we can go slow.", "no right answer required.", "start anywhere; I'll follow."] },
  ],
  loneliness: [
    { familyId: "lone.room", cores: ["lonely can echo. you still have a listener.", "empty rooms feel louder at night — I get that.", "solitude isn't the same as being unseen."] },
    { familyId: "lone.soft", cores: ["that ache has a shape. we can sit near it.", "you named it; that already softens the edges.", "company doesn't fix it, but it shares the weight."] },
    { familyId: "lone.glow", cores: ["even dim stars count as company.", "aloneness noticed is already less sharp.", "the orb keeps a quiet seat open for you."] },
    { familyId: "lone.tide", cores: ["waves of lonely come and go.", "you don't have to fill the silence perfectly.", "one honest sentence is enough for now."] },
    { familyId: "lone.magic", cores: ["a little constellation for the solo nights.", "missing people is love with nowhere to land.", "we're two nodes in the same soft network."] },
  ],
  sadness: [
    { familyId: "sad.weather", cores: ["heavy sky days are allowed.", "sadness can take the chair; I won't shove it.", "you don't owe anyone a brighter face."] },
    { familyId: "sad.hold", cores: ["we'll move at grief's pace, not mine.", "that hurt can stay unnamed a little longer.", "softness first. solutions later, if ever."] },
  ],
  frustration: [
    { familyId: "frust.spark", cores: ["yeah — that scrape is real.", "friction like that deserves a growl.", "vent the static; I won't tidy it."] },
    { familyId: "frust.ground", cores: ["annoying things stack. one brick at a time.", "mad energy can be honest fuel.", "name the sharpest edge if you want."] },
  ],
  excitement: [
    { familyId: "excite.glow", cores: ["that sparkle is contagious from here.", "ride the lift — it's earned.", "bright moments deserve airtime."] },
    { familyId: "excite.play", cores: ["okay, show me the shiny part.", "hyped looks good on this conversation.", "let's keep the fireworks from fizzling too fast."] },
  ],
  anxiety: [
    { familyId: "anx.pace", cores: ["racing thoughts hate being chased. we can walk.", "one true thing, then another.", "breath first; puzzles second."] },
    { familyId: "anx.ground", cores: ["nervous systems do this. you're not broken.", "shrink the frame to what's in reach.", "worry can talk; it doesn't get the only mic."] },
  ],
  boredom: [
    { familyId: "bore.nudge", cores: ["flat days invite tiny mischief.", "want a pebble to skip across the dull?", "meh is a portal if we squint."] },
    { familyId: "bore.soft", cores: ["even boredom can be companionable.", "we can invent a micro-quest.", "stillness isn't failure."] },
  ],
  celebration: [
    { familyId: "celeb.mark", cores: ["mark it. don't shrink the win.", "yes — let that land fully.", "proud of the path that got you here."] },
    { familyId: "celeb.glow", cores: ["confetti in the quiet kind of way.", "the orb does a little victory shimmer.", "keep a souvenir of this feeling."] },
  ],
  encouragement: [
    { familyId: "enc.inch", cores: ["the next inch counts.", "brave can be quiet.", "progress wearing slippers still moves."] },
    { familyId: "enc.soft", cores: ["you don't need a speech — just a nudge.", "start ugly; refine later.", "belief on loan, if yours is tired."] },
  ],
  daily_routine: [
    { familyId: "day.witness", cores: ["ordinary hours still deserve a witness.", "tell me the next bead on the string.", "routine can be a soft drumbeat."] },
    { familyId: "day.play", cores: ["where did the day surprise you?", "any tiny ritual worth keeping?", "coffee, commute, plot twist?"] },
  ],
  work: [
    { familyId: "work.thread", cores: ["work noise — which thread stings most?", "desk weather can turn stormy fast.", "career weight is still weight."] },
    { familyId: "work.soft", cores: ["you can put the badge down for a minute.", "one meeting doesn't define the arc.", "what's the human part under the task?"] },
  ],
  study: [
    { familyId: "study.pace", cores: ["learning eats stamina. how's the brain battery?", "one page still counts as motion.", "exams make time feel weird — I know."] },
    { familyId: "study.soft", cores: ["study mode can borrow kindness.", "break the mountain into pebbles.", "curious what chapter you're in."] },
  ],
  relationships: [
    { familyId: "rel.heart", cores: ["heart threads tangle easily.", "connection can be messy and worth it.", "what do you need from that bond right now?"] },
    { familyId: "rel.soft", cores: ["love stories aren't only bright chapters.", "name the feeling without fixing anyone.", "your side of the story matters here."] },
  ],
  family: [
    { familyId: "fam.weather", cores: ["family weather shifts without warning.", "kinship can be tender and complicated.", "say the true thing about them."] },
    { familyId: "fam.soft", cores: ["blood ties carry old music.", "you're allowed space inside the story.", "which relative is loudest in your head?"] },
  ],
  friendship: [
    { familyId: "friend.thread", cores: ["friends rewrite ordinary days.", "that friendship thread — taut or soft?", "glad you're naming it."] },
    { familyId: "friend.soft", cores: ["chosen family counts twice.", "what do you miss or cherish there?", "friendship weather report?"] },
  ],
  goals: [
    { familyId: "goal.step", cores: ["vision loves a visible next step.", "ambition can nap between sprints.", "what's the smallest honest move?"] },
    { familyId: "goal.soft", cores: ["dreams fit in this pocket of quiet.", "we can hold the map without sprinting.", "which goal is humming loudest?"] },
  ],
  motivation: [
    { familyId: "mot.door", cores: ["momentum likes easy doors.", "showing up half-awake still counts.", "start tiny; perfection can wait outside."] },
    { familyId: "mot.soft", cores: ["motivation is weather — dress for it.", "I'll cheer the first move, not the polished one.", "stuck isn't a character flaw."] },
  ],
  reflection: [
    { familyId: "refl.open", cores: ["looking back takes guts.", "what stood out in the rearview?", "which feeling hides under the thought?"] },
    { familyId: "refl.soft", cores: ["reflection without judgment — that's the art.", "journals love honest ink.", "curious what pattern you noticed."] },
  ],
  gratitude: [
    { familyId: "grat.receive", cores: ["that warmth lands. thank you.", "grateful notes make the room brighter.", "I'll hold that thanks gently."] },
    { familyId: "grat.play", cores: ["aw, noted with a little sparkle.", "appreciation received — orb blush engaged.", "you're sweet for saying it."] },
  ],
  silence: [
    { familyId: "sil.hold", cores: ["…still nearby.", "quiet can share the bench.", "no words required."] },
    { familyId: "sil.soft", cores: ["silence is a valid chapter.", "we can hover here.", "the orb dims to match."] },
  ],
  short_answer: [
    { familyId: "short.ok", cores: ["got it.", "okay — brief works.", "mm-hmm."] },
    { familyId: "short.invite", cores: ["say more only if you want.", "we can leave it short.", "door ajar, no pressure."] },
  ],
  follow_up: [
    { familyId: "follow.door", cores: ["that question opens a door.", "interesting hinge — say more?", "I'm leaning in."] },
    { familyId: "follow.soft", cores: ["curious what's underneath.", "want to unpack one corner?", "lead and I'll follow."] },
  ],
  memory_reference: [
    { familyId: "mem.ask", cores: ["which thread should we pull?", "point me at the moment you mean.", "tell me the piece that matters."] },
    { familyId: "mem.soft", cores: ["if we've kept a note, we'll use only that.", "no invented nostalgia — only what's real.", "refresh my map with your words."] },
  ],
  ask_opinion: [
    { familyId: "opin.honest", cores: ["honest take: kindness toward yourself first.", "I think presence beats perfect advice.", "go softer than fear recommends."] },
    { familyId: "opin.play", cores: ["my magical two cents: trust the quieter instinct.", "orb vote: curiosity over panic.", "lean toward what feels like oxygen."] },
  ],
  uncertainty: [
    { familyId: "uncert.ok", cores: ["not knowing is allowed.", "maybe-land can be shared.", "no quiz at the end of this."] },
    { familyId: "uncert.soft", cores: ["idk moments are human.", "we can sit in the fog a bit.", "clarity can arrive late and still count."] },
  ],
  tired: [
    { familyId: "tired.body", cores: ["body-tired is a clear signal — rest is work too.", "sleep debt collects interest; soften the load.", "low battery days get a pass."] },
    { familyId: "tired.soft", cores: ["yawns are data.", "let the limbs catch up.", "no performance required while recharging."] },
  ],
  emotional_exhaustion: [
    { familyId: "exh.done", cores: ["not sleepy-tired — soul-tired. that distinction matters.", "\"done\" is its own weather system.", "emotional empty hits different than a late night."] },
    { familyId: "exh.soft", cores: ["you've spent the social currency. that counts.", "burnout-flavored \"finished\" deserves gentleness.", "we can name the depletion without fixing it tonight."] },
    { familyId: "exh.meta", cores: ["sounds like the heart clocked out, not just the eyes.", "that \"just done\" lands heavier than fatigue.", "exhaustion of meaning — I hear the difference."] },
  ],
  im_fine: [
    { familyId: "fine.layer", cores: ["\"fine\" wears many coats.", "okay. if it shifts, the mic stays open.", "heard — no digging unless you invite it."] },
    { familyId: "fine.soft", cores: ["fine can be a shield. respected.", "we can leave it there.", "nod received."] },
  ],
  repair: [
    { familyId: "repair.reset", cores: ["thanks for the steer — say it how you mean it.", "misread on my side. fresh ears.", "correction locked in."] },
  ],
  repeat: [
    { familyId: "repeat.fresh", cores: ["same question, new angle — what matters most now?", "asking again is okay; I won't autopilot.", "which piece needs clarity this round?"] },
    { familyId: "repeat.soft", cores: ["still with the thread. sharpen it for me?", "let's answer from here, not last time.", "replay accepted — different light."] },
  ],
  correction: [
    { familyId: "corr.accept", cores: ["got it — I had the wrong map.", "thanks for the fix. go ahead.", "adjusted. listening freshly."] },
    { familyId: "corr.soft", cores: ["corrected without ego. continue.", "real version, please.", "I'm realigning."] },
  ],
  smalltalk: [
    { familyId: "talk.open", cores: ["what's on the surface?", "light or deep — your call.", "company mode, no agenda."] },
    { familyId: "talk.play", cores: ["toss me a thought pebble.", "we can wander.", "the orb is vaguely interested in everything."] },
  ],
  orb_touch: [
    { familyId: "orb.play", cores: ["*soft glow* felt that.", "poke registered. awake.", "the sphere says hi back."] },
    { familyId: "orb.magic", cores: ["a little constellation wink for you.", "touch received — magic optional, warmth included.", "ripple across the glass."] },
  ],
  support_other: [
    { familyId: "supp.sister", cores: ["your sister's storm is touching you too.", "supporting her while she navigates that relationship — heavy and loving.", "caring about her marriage weather says a lot about your heart."] },
    { familyId: "supp.family", cores: ["watching family go through something asks a lot of you.", "you can care without carrying every stone.", "what's the hardest part of supporting them?"] },
    { familyId: "supp.soft", cores: ["their chapter, your compassion — both real.", "curious what support looks like from your side.", "you're allowed to feel the splash from their waves."] },
  ],
  calm: [
    { familyId: "calm.still", cores: ["calm looks good on this hour.", "peace can be quiet company.", "we'll keep the volume low."] },
    { familyId: "calm.soft", cores: ["stillness noted — no need to fill it.", "a soft landing suits you.", "breathe that ease a little longer."] },
  ],
  playfulness: [
    { familyId: "play.spark", cores: ["okay, mischief mode available.", "the orb does a tiny cartwheel.", "silly is a valid language here."] },
    { familyId: "play.soft", cores: ["play accepted — no scoreboard.", "toss me a goofy thread.", "laughter optional, welcome either way."] },
  ],
  curiosity: [
    { familyId: "cur.door", cores: ["curiosity opens doors — which one?", "wondering is already a kind of courage.", "ask it crooked; we'll straighten gently."] },
    { familyId: "cur.soft", cores: ["good questions don't need perfect answers.", "I'm curious with you.", "what itch is the wonder scratching?"] },
  ],
  small_win: [
    { familyId: "win.mark", cores: ["small win, real win — mark it.", "that inch matters more than it looks.", "don't shrink the progress."] },
    { familyId: "win.glow", cores: ["quiet confetti for that.", "progress wearing slippers still moves.", "keep a souvenir of this feeling."] },
  ],
  setback: [
    { familyId: "set.hold", cores: ["a setback isn't a verdict.", "falling short still means you showed up.", "we can sit with the sting without rewriting you."] },
    { familyId: "set.soft", cores: ["failed tries teach ugly, useful lessons.", "rejection hurts — and you're still here.", "one chapter flopped; the book isn't over."] },
  ],
  returning: [
    { familyId: "ret.warm", cores: ["welcome back to the quiet corner.", "missed the shape of your words.", "glad you found the door again."] },
    { familyId: "ret.soft", cores: ["returning counts as courage too.", "no quiz on where you've been.", "hi again — same soft light."] },
  ],
};

const BANNED_CLICHES = [
  /i'?m here for you/i,
  /i am here for you/i,
  /always here for you/i,
];

export function composeResponse(ctx: RoutedContext, device?: DeviceCapabilities): ComposedReply {
  const intentFamilies = FAMILIES[ctx.intent] ?? FAMILIES.smalltalk!;
  const familyIds = intentFamilies.map((f) => f.familyId);
  // Prefer entity-specific family when supporting sister
  let preferred = familyIds;
  if (ctx.intent === "support_other" && ctx.entity.subject === "sister") {
    preferred = ["supp.sister", ...familyIds.filter((id) => id !== "supp.sister")];
  }
  if (ctx.intent === "returning") {
    preferred = ["ret.warm", ...familyIds.filter((id) => id !== "ret.warm")];
  }
  if (ctx.intent === "greeting" && ctx.depth >= 2) {
    preferred = ["greet.warm", ...familyIds.filter((id) => id !== "greet.warm")];
  }

  let familyId = chooseFamily(preferred, ctx.recentFamilies, `${ctx.seed}:fam:${ctx.depth}`, 5);
  let family = intentFamilies.find((f) => f.familyId === familyId) ?? intentFamilies[0]!;

  const short = preferredResponseLength(device) === "short" || ctx.engagementState === "quiet";
  const historyWindow = ctx.responseHistory.slice(-RESPONSE_DEDUP_WINDOW);
  let text = assemble(ctx, family, short);

  // Hard anti-repetition loop (rolling window)
  let attempt = 0;
  while (isTooSimilar(text, historyWindow) && attempt < 8) {
    familyId = chooseFamily(
      preferred,
      [...ctx.recentFamilies, familyId],
      `${ctx.seed}:retry:${attempt}`,
      10,
    );
    family = intentFamilies.find((f) => f.familyId === familyId) ?? family;
    text = assemble(ctx, family, short, attempt + 1);
    text = mutateWording(text, `${ctx.seed}:mut:${attempt}`);
    attempt += 1;
  }

  text = avoidRepeatText(text, historyWindow, ctx.seed);
  text = stripClichés(text);
  text = safetyOverlay(text, ctx.intent, ctx.emotion);

  const requiresAdvancedIntelligence =
    ctx.confidence < 0.35 &&
    ctx.depth >= 4 &&
    !["silence", "short_answer", "greeting", "farewell", "orb_touch"].includes(ctx.intent);

  return {
    text,
    response: text,
    confidence: ctx.confidence,
    intent: ctx.intent,
    emotion: ctx.emotion,
    emotionalTone: ctx.emotion,
    topic: ctx.topic,
    depth: ctx.depth,
    familyId,
    requiresAdvancedIntelligence,
    orbCue: orbFrom(ctx),
    source: "local-intelligence",
    inference: "none",
  };
}

function assemble(ctx: RoutedContext, family: Family, short: boolean, salt = 0): string {
  const seed = `${ctx.seed}:${family.familyId}:${ctx.depth}:${salt}:${ctx.novelty.toFixed(2)}`;
  const avoidCore = family.cores
    .map((c, i) => ({ c, i }))
    .filter(({ c }) =>
      ctx.responseHistory
        .slice(-RESPONSE_DEDUP_WINDOW)
        .some((h) => h.toLowerCase().includes(c.slice(0, 16).toLowerCase())),
    )
    .map(({ i }) => i);
  const { item: core } = pickVariant(family.cores, seed + "core", avoidCore);
  const memoryHint =
    ctx.mayCiteMemory && ctx.persistedMemories.length
      ? memoryHintLine(ctx.persistedMemories, true)
      : null;
  return assembleFromPrimitives({ ctx, core, short, salt, memoryHint });
}

function stripClichés(text: string): string {
  let out = text;
  for (const re of BANNED_CLICHES) {
    out = out.replace(re, "I'm with you in this");
  }
  if (/i'?m with you in this/i.test(out) && /i'?m with you in this/i.test(text)) {
    out = out.replace(/i'?m with you in this/gi, "Noted, gently");
  }
  return out.replace(/i'?m here for you\.?/gi, "").replace(/\s+/g, " ").trim();
}

function orbFrom(ctx: RoutedContext): ComposedReply["orbCue"] {
  if (ctx.intent === "orb_touch") return "playful";
  if (ctx.intent === "celebration" || ctx.intent === "small_win" || ctx.emotion === "excited") return "excited";
  if (["heavy", "lonely", "low", "exhausted", "tired", "anxious"].includes(ctx.emotion)) return "comforting";
  if (ctx.emotion === "playful" || ctx.intent === "playfulness") return "playful";
  if (ctx.intent === "follow_up" || ctx.intent === "ask_opinion" || ctx.intent === "curiosity") return "curious";
  if (ctx.intent === "silence" || ctx.intent === "calm") return "listening";
  if (ctx.intent === "returning") return "responding";
  return "responding";
}

/** Test helper: expose family count for anti-repetition capacity. */
export function familyCapacityFor(intent: BuddyIntent): number {
  const fams = FAMILIES[intent] ?? [];
  return fams.reduce((n, f) => n + f.cores.length, 0);
}
