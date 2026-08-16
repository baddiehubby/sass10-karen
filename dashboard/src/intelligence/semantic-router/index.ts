/**
 * Multi-signal semantic understanding — not single-keyword routing.
 */

import type { BuddyEmotion, BuddyIntent, BuddyTopic, EntityFrame } from "@/src/intelligence/types";

export type SemanticHit = {
  intent: BuddyIntent;
  emotion: BuddyEmotion;
  topic: BuddyTopic;
  subtopic: string | null;
  confidence: number;
  entity: EntityFrame;
  signals: string[];
};

type Signal = {
  id: string;
  intent: BuddyIntent;
  emotion?: BuddyEmotion;
  topic?: BuddyTopic;
  subtopic?: string;
  weight: number;
  score: (ctx: SignalContext) => number;
};

type SignalContext = {
  raw: string;
  t: string;
  tokens: string[];
  tokenSet: Set<string>;
  hasNegation: boolean;
  isQuestion: boolean;
  previousTopic?: BuddyTopic;
};

const FAMILY_WORDS: Record<string, string[]> = {
  tired_physical: ["tired", "sleepy", "exhausted", "drained", "worn", "fatigue", "fatigued", "drowsy"],
  tired_emotional: ["done", "finished", "overwhelmed", "burned", "burnt", "had enough", "spent", "empty", "numb"],
  sad: ["sad", "down", "cry", "crying", "heartbroken", "miserable", "hurt", "blue", "gloomy"],
  anxious: ["anxious", "anxiety", "worried", "nervous", "panic", "stressed", "stress", "overwhelmed", "uneasy"],
  lonely: ["lonely", "alone", "isolated", "nobody", "no one"],
  frustrate: ["frustrated", "annoyed", "angry", "pissed", "irritated", "furious"],
  excite: ["excited", "pumped", "hyped", "thrilled", "stoked", "ecstatic"],
  work: ["work", "job", "boss", "coworker", "meeting", "deadline", "office", "shift", "career"],
  study: ["study", "studying", "exam", "homework", "class", "lecture", "assignment", "school", "college", "uni"],
  family: ["mom", "dad", "mum", "parent", "sister", "brother", "family", "kids", "child", "aunt", "uncle"],
  relationship: ["husband", "wife", "boyfriend", "girlfriend", "partner", "spouse", "dating", "marriage", "crush"],
  friend: ["friend", "bestie", "mate"],
  support: ["going through", "supporting", "worried about", "help her", "help him", "there for"],
};

function hasAny(set: Set<string>, words: string[]): boolean {
  for (const w of words) {
    if (set.has(w)) return true;
    // Prefix match only for longer stems — avoid "mad" matching "made"
    if (w.length >= 5) {
      for (const t of set) {
        if (t.startsWith(w)) return true;
      }
    }
  }
  return false;
}

function phraseHas(t: string, phrases: string[]): boolean {
  return phrases.some((p) => t.includes(p));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function fuzzyIncludes(t: string, stem: string): boolean {
  if (t.includes(stem)) return true;
  // light typo tolerance: allow one-char gap in stem for longer stems
  if (stem.length < 5) return false;
  const re = new RegExp(stem.split("").join(".?"));
  return re.test(t);
}

const SIGNALS: Signal[] = [
  {
    id: "greet",
    intent: "greeting",
    emotion: "warm",
    topic: "buddy",
    weight: 1,
    score: (c) => (/^(hi|hello|hey|yo|howdy)\b/.test(c.t) || phraseHas(c.t, ["good morning", "good evening", "hey buddy", "hi buddie"]) ? 1 : 0),
  },
  {
    id: "bye",
    intent: "farewell",
    emotion: "warm",
    topic: "buddy",
    weight: 1,
    score: (c) => (/^(bye|goodbye|later|gn)\b/.test(c.t) || phraseHas(c.t, ["see you", "gotta go", "talk later", "good night"]) ? 1 : 0),
  },
  {
    id: "negated_tired_done",
    intent: "emotional_exhaustion",
    emotion: "exhausted",
    topic: "self",
    subtopic: "emotional_exhaustion",
    weight: 1.15,
    score: (c) => {
      const negTired = /not\s+tired|isn'?t\s+tired|aren'?t\s+tired|don'?t\s+feel\s+tired/.test(c.t);
      const done = hasAny(c.tokenSet, FAMILY_WORDS.tired_emotional) || phraseHas(c.t, ["just done", "had enough", "burned out", "burnt out"]);
      return negTired && done ? 1 : phraseHas(c.t, ["emotionally exhausted", "emotionally done", "just done with"]) ? 0.95 : 0;
    },
  },
  {
    id: "physical_tired",
    intent: "tired",
    emotion: "tired",
    topic: "rest",
    subtopic: "physical",
    weight: 0.9,
    score: (c) => {
      if (/not\s+tired|isn'?t\s+tired/.test(c.t)) return 0;
      const phys = hasAny(c.tokenSet, FAMILY_WORDS.tired_physical) || phraseHas(c.t, ["need sleep", "so sleepy"]);
      const emoDone = hasAny(c.tokenSet, ["done", "finished"]) && /just done|i'?m done/.test(c.t);
      if (phys && !emoDone) return 1;
      if (phys) return 0.55;
      return 0;
    },
  },
  {
    id: "lonely",
    intent: "loneliness",
    emotion: "lonely",
    topic: "self",
    weight: 0.95,
    score: (c) =>
      hasAny(c.tokenSet, FAMILY_WORDS.lonely) ||
      phraseHas(c.t, ["by myself", "no one around", "lonley", "lonly", "so alone"]) ||
      fuzzyIncludes(c.t, "lonely")
        ? 1
        : 0,
  },
  {
    id: "sad",
    intent: "sadness",
    emotion: "heavy",
    topic: "self",
    weight: 0.9,
    score: (c) => (hasAny(c.tokenSet, FAMILY_WORDS.sad) ? 1 : fuzzyIncludes(c.t, "heartbroken") ? 0.8 : 0),
  },
  {
    id: "frust",
    intent: "frustration",
    emotion: "frustrated",
    topic: "self",
    weight: 0.9,
    score: (c) => (hasAny(c.tokenSet, FAMILY_WORDS.frustrate) || phraseHas(c.t, ["fed up", "hate this", "so mad", "mad at"]) ? 1 : 0),
  },
  {
    id: "excite",
    intent: "excitement",
    emotion: "excited",
    topic: "self",
    weight: 0.85,
    score: (c) => (hasAny(c.tokenSet, FAMILY_WORDS.excite) || phraseHas(c.t, ["can't wait", "so happy"]) ? 1 : 0),
  },
  {
    id: "anx",
    intent: "anxiety",
    emotion: "anxious",
    topic: "self",
    weight: 0.9,
    score: (c) => (hasAny(c.tokenSet, FAMILY_WORDS.anxious) || phraseHas(c.t, ["freaking out", "on edge"]) ? 1 : 0),
  },
  {
    id: "bore",
    intent: "boredom",
    emotion: "bored",
    topic: "day",
    weight: 0.85,
    score: (c) => (c.tokenSet.has("bored") || phraseHas(c.t, ["nothing to do", "so dull"]) ? 1 : 0),
  },
  {
    id: "celeb",
    intent: "celebration",
    emotion: "excited",
    topic: "celebration",
    weight: 0.95,
    score: (c) => (phraseHas(c.t, ["got the job", "we did it", "finally did it", "promoted", "i won", "i passed"]) || c.tokenSet.has("celebrate") ? 1 : 0),
  },
  {
    id: "thanks",
    intent: "gratitude",
    emotion: "grateful",
    topic: "self",
    weight: 0.9,
    score: (c) => (phraseHas(c.t, ["thank you", "thanks", "grateful", "appreciate"]) ? 1 : 0),
  },
  {
    id: "support_family_rel",
    intent: "support_other",
    emotion: "warm",
    topic: "family",
    subtopic: "supporting_relative",
    weight: 1.05,
    score: (c) => {
      const fam = hasAny(c.tokenSet, FAMILY_WORDS.family);
      const rel = hasAny(c.tokenSet, FAMILY_WORDS.relationship);
      const support = phraseHas(c.t, FAMILY_WORDS.support) || phraseHas(c.t, ["going through something", "going through a"]);
      if (fam && (rel || support)) return 1;
      if (fam && support) return 0.95;
      return 0;
    },
  },
  {
    id: "family",
    intent: "family",
    emotion: "warm",
    topic: "family",
    weight: 0.85,
    score: (c) => (hasAny(c.tokenSet, FAMILY_WORDS.family) ? 0.9 : 0),
  },
  {
    id: "rel",
    intent: "relationships",
    emotion: "warm",
    topic: "relationships",
    weight: 0.85,
    score: (c) => (hasAny(c.tokenSet, FAMILY_WORDS.relationship) ? 0.9 : 0),
  },
  {
    id: "friend",
    intent: "friendship",
    emotion: "warm",
    topic: "friendship",
    weight: 0.8,
    score: (c) => (hasAny(c.tokenSet, FAMILY_WORDS.friend) ? 0.9 : 0),
  },
  {
    id: "work",
    intent: "work",
    emotion: "neutral",
    topic: "work",
    weight: 0.85,
    score: (c) => (hasAny(c.tokenSet, FAMILY_WORDS.work) ? 0.9 : 0),
  },
  {
    id: "study",
    intent: "study",
    emotion: "neutral",
    topic: "study",
    weight: 0.85,
    score: (c) => (hasAny(c.tokenSet, FAMILY_WORDS.study) ? 0.9 : 0),
  },
  {
    id: "goals",
    intent: "goals",
    emotion: "warm",
    topic: "goals",
    weight: 0.8,
    score: (c) => (hasAny(c.tokenSet, ["goal", "goals", "ambition", "dream"]) || phraseHas(c.t, ["want to achieve"]) ? 1 : 0),
  },
  {
    id: "motivation",
    intent: "motivation",
    emotion: "warm",
    topic: "goals",
    weight: 0.85,
    score: (c) => (hasAny(c.tokenSet, ["motivation", "motivated"]) || phraseHas(c.t, ["can't start", "procrastinating"]) ? 1 : 0),
  },
  {
    id: "reflect",
    intent: "reflection",
    emotion: "warm",
    topic: "self",
    weight: 0.85,
    score: (c) => (fuzzyIncludes(c.t, "reflect") || phraseHas(c.t, ["looking back", "thinking about", "journal"]) ? 1 : 0),
  },
  {
    id: "routine",
    intent: "daily_routine",
    emotion: "neutral",
    topic: "day",
    weight: 0.75,
    score: (c) => (phraseHas(c.t, ["this morning", "today i", "tonight i", "my day", "commute", "morning routine"]) ? 1 : 0),
  },
  {
    id: "checkin",
    intent: "emotional_checkin",
    emotion: "warm",
    topic: "self",
    weight: 0.88,
    score: (c) => {
      if (phraseHas(c.t, ["how are you", "how r you", "how's it going", "checking in"])) return 1;
      if (/^i feel\b/.test(c.t) && c.tokens.length <= 6) {
        // Defer to specific emotion intents when an emotion word is present
        if (hasAny(c.tokenSet, ["calm", "lonely", "sad", "anxious", "happy", "tired", "angry", "bored"])) {
          return 0;
        }
        return 1;
      }
      return 0;
    },
  },
  {
    id: "memory",
    intent: "memory_reference",
    emotion: "warm",
    topic: "memory",
    weight: 0.96,
    score: (c) => (phraseHas(c.t, ["remember when", "you said", "last time", "do you recall", "that moment"]) ? 1 : 0),
  },
  {
    id: "opinion",
    intent: "ask_opinion",
    emotion: "playful",
    topic: "buddy",
    weight: 0.9,
    score: (c) => (phraseHas(c.t, ["what do you think", "your take", "your opinion", "do you think"]) ? 1 : 0),
  },
  {
    id: "uncertain",
    intent: "uncertainty",
    emotion: "low",
    topic: "self",
    weight: 0.85,
    score: (c) => (phraseHas(c.t, ["i don't know", "i dont know", "idk", "not sure", "no idea", "dunno"]) ? 1 : 0),
  },
  {
    id: "fine",
    intent: "im_fine",
    emotion: "neutral",
    topic: "self",
    weight: 0.8,
    score: (c) => (/^(i'?m )?(fine|ok|okay|alright|nothing)\.?$/.test(c.t) || phraseHas(c.t, ["i'm fine", "im fine"]) ? 1 : 0),
  },
  {
    id: "encourage",
    intent: "encouragement",
    emotion: "warm",
    topic: "goals",
    weight: 0.8,
    score: (c) => (phraseHas(c.t, ["cheer me", "encourage me", "pep talk", "motivate me"]) ? 1 : 0),
  },
  {
    id: "calm",
    intent: "calm",
    emotion: "calm",
    topic: "self",
    weight: 0.95,
    score: (c) =>
      phraseHas(c.t, ["i feel calm", "feeling calm", "peaceful", "at peace", "relaxed", "feeling chill"]) ||
      /^i'?m (calm|chill|peaceful)\.?$/.test(c.t)
        ? 1
        : 0,
  },
  {
    id: "playful",
    intent: "playfulness",
    emotion: "playful",
    topic: "buddy",
    weight: 0.86,
    score: (c) =>
      phraseHas(c.t, ["let's play", "be silly", "make me laugh", "joke with me", "goofy"]) ||
      c.tokenSet.has("haha") ||
      c.tokenSet.has("lol")
        ? 0.95
        : 0,
  },
  {
    id: "curious",
    intent: "curiosity",
    emotion: "curious",
    topic: "buddy",
    weight: 0.86,
    score: (c) =>
      phraseHas(c.t, ["i'm curious", "im curious", "wondering about", "what if", "just curious"])
        ? 1
        : 0,
  },
  {
    id: "small_win",
    intent: "small_win",
    emotion: "excited",
    topic: "celebration",
    weight: 0.92,
    score: (c) =>
      phraseHas(c.t, [
        "small win",
        "tiny win",
        "finally finished",
        "i finished",
        "got it done",
        "made progress",
        "little victory",
      ])
        ? 1
        : 0,
  },
  {
    id: "setback",
    intent: "setback",
    emotion: "heavy",
    topic: "self",
    weight: 0.92,
    score: (c) =>
      phraseHas(c.t, [
        "i failed",
        "i messed up",
        "didn't get",
        "rejected",
        "lost the",
        "bombed",
        "fell short",
        "didn't work",
      ])
        ? 1
        : 0,
  },
  {
    id: "returning",
    intent: "returning",
    emotion: "warm",
    topic: "buddy",
    weight: 0.95,
    score: (c) =>
      phraseHas(c.t, ["i'm back", "im back", "missed you", "back again", "returning", "been a while"])
        ? 1
        : 0,
  },
  {
    id: "silence",
    intent: "silence",
    emotion: "neutral",
    topic: "none",
    weight: 1,
    score: (c) => (c.t.length === 0 || /^[.…]{1,8}$/.test(c.t) || /^(\.\.\.|…)$/.test(c.t) ? 1 : 0),
  },
  {
    id: "orb",
    intent: "orb_touch",
    emotion: "playful",
    topic: "buddy",
    weight: 1,
    score: (c) => (/^\[orb[_-]touch\]$/.test(c.t) || phraseHas(c.t, ["poke", "tap the orb"]) ? 1 : 0),
  },
];

export function routeSemantic(
  userText: string,
  opts?: {
    isRepair?: boolean;
    isRepeat?: boolean;
    isShort?: boolean;
    previousTopic?: BuddyTopic;
    previousMessages?: string[];
  },
): SemanticHit {
  const raw = userText;
  const t = userText.toLowerCase().trim();
  const tokens = t.replace(/[^a-z0-9\s']/g, " ").split(/\s+/).filter(Boolean);
  const tokenSet = new Set(tokens.map((w) => w.replace(/'/g, "")));
  const hasNegation = /\b(not|n't|never|no)\b/.test(t);
  const isQuestion = /\?$/.test(t) || /^(what|why|how|when|where|who)\b/.test(t);

  if (opts?.isRepair) {
    return hit("correction", "warm", "buddy", null, 0.95, emptyEntity(), ["repair"]);
  }
  if (opts?.isRepeat) {
    return hit("repeat", "warm", "buddy", null, 0.9, emptyEntity(), ["repeat"]);
  }

  // Non-latin heavy input: stay present without pretending full comprehension
  if (isMostlyNonLatin(raw) && t.replace(/[^a-z0-9\s']/g, "").trim().length < 3) {
    return hit("smalltalk", "warm", opts?.previousTopic ?? "buddy", null, 0.45, emptyEntity(), [
      "multilingual",
      "uncertain_comprehension",
    ]);
  }

  const ctx: SignalContext = {
    raw,
    t,
    tokens,
    tokenSet,
    hasNegation,
    isQuestion,
    previousTopic: opts?.previousTopic,
  };

  let best: { signal: Signal; score: number } | null = null;
  const fired: string[] = [];
  for (const signal of SIGNALS) {
    const scored = signal.score(ctx);
    if (scored <= 0) continue;
    fired.push(signal.id);
    const weighted = scored * signal.weight;
    let boost = weighted;
    if (opts?.previousTopic && signal.topic === opts.previousTopic) boost += 0.05;
    if (opts?.previousMessages?.length) {
      const prev = new Set(
        opts.previousMessages
          .join(" ")
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 2),
      );
      boost += jaccard(tokenSet, prev) * 0.08;
    }
    if (!best || boost > best.score) best = { signal, score: boost };
  }

  if (opts?.isShort && tokens.length <= 2 && (!best || best.score < 0.8)) {
    return hit("short_answer", "neutral", "self", null, 0.75, emptyEntity(), ["short"]);
  }

  if (
    best &&
    looksSarcastic(t) &&
    ["celebration", "excitement", "gratitude", "small_win"].includes(best.signal.intent)
  ) {
    return hit("uncertainty", "playful", best.signal.topic ?? "self", "possible_sarcasm", 0.42, emptyEntity(), [
      ...fired,
      "sarcasm",
    ]);
  }

  if (best && looksAmbiguous(t) && best.score < 0.95) {
    const lowered = Math.min(best.score, 0.55);
    if (lowered < 0.5) {
      return hit("uncertainty", "low", best.signal.topic ?? "self", "ambiguous", 0.48, emptyEntity(), [
        ...fired,
        "ambiguous",
      ]);
    }
    best = { signal: best.signal, score: lowered };
  }

  if (best && opts?.previousMessages?.length && contradictsPrevious(t, opts.previousMessages)) {
    const entity = extractEntities(t, tokenSet, best.signal.intent);
    return hit(
      best.signal.intent,
      best.signal.emotion ?? "neutral",
      best.signal.topic ?? "none",
      "mood_shift",
      Math.min(0.7, best.score),
      entity,
      [...fired, "contradiction"],
    );
  }

  if (best) {
    const entity = extractEntities(t, tokenSet, best.signal.intent);
    return hit(
      best.signal.intent,
      best.signal.emotion ?? "neutral",
      best.signal.topic ?? "none",
      best.signal.subtopic ?? null,
      Math.min(1, best.score),
      entity,
      fired,
    );
  }

  if (isQuestion) {
    return hit("follow_up", "playful", opts?.previousTopic ?? "buddy", null, 0.55, emptyEntity(), ["question"]);
  }

  return hit("smalltalk", "warm", opts?.previousTopic ?? "day", null, 0.4, emptyEntity(), ["fallback"]);
}

function looksSarcastic(t: string): boolean {
  return (
    /\bsarcasm\b|\/s\b|yeah right|sure jan|as if\b|totally not|just kidding|jk\b|lol not really/i.test(t) ||
    /love (my|this) (job|life|boss).*(not|\/s)/i.test(t)
  );
}

function looksAmbiguous(t: string): boolean {
  return /\b(maybe|might|not sure|i think|perhaps|could be|i guess|idk)\b/i.test(t);
}

/** Detect mood polarity flip vs last user utterance. */
export function contradictsPrevious(current: string, previousMessages: string[]): boolean {
  const prev = (previousMessages[previousMessages.length - 1] ?? "").toLowerCase();
  if (!prev || prev.length < 3) return false;
  const pos = /\b(happy|great|amazing|love|excited|good|fine|awesome)\b/;
  const neg =
    /\b(sad|hate|awful|terrible|miserable|lonely|anxious|angry|frustrated)\b|not (happy|fine|good|great)/;
  const cur = current.toLowerCase();
  return (pos.test(prev) && neg.test(cur)) || (neg.test(prev) && pos.test(cur) && !neg.test(cur));
}


export function normalizeEmotion(emotion: BuddyEmotion): BuddyEmotion {
  return emotion;
}

function hit(
  intent: BuddyIntent,
  emotion: BuddyEmotion,
  topic: BuddyTopic,
  subtopic: string | null,
  confidence: number,
  entity: EntityFrame,
  signals: string[],
): SemanticHit {
  return { intent, emotion, topic, subtopic, confidence, entity, signals };
}

function emptyEntity(): EntityFrame {
  return { subject: null, relationship: null, concern: null, secondaryTopic: null };
}

function extractEntities(t: string, tokenSet: Set<string>, intent: BuddyIntent): EntityFrame {
  const people: Array<{ word: string; rel: string }> = [
    { word: "sister", rel: "sister" },
    { word: "brother", rel: "brother" },
    { word: "mom", rel: "mother" },
    { word: "mum", rel: "mother" },
    { word: "dad", rel: "father" },
    { word: "husband", rel: "spouse" },
    { word: "wife", rel: "spouse" },
    { word: "partner", rel: "partner" },
    { word: "friend", rel: "friend" },
  ];

  let subject: string | null = null;
  let relationship: string | null = null;
  for (const p of people) {
    if (tokenSet.has(p.word) || t.includes(`my ${p.word}`)) {
      if (!subject || p.word === "sister" || p.word === "brother" || p.word === "mom" || p.word === "dad") {
        subject = p.word;
        relationship = p.rel;
      }
    }
  }

  let secondaryTopic: BuddyTopic | null = null;
  if (hasAny(tokenSet, FAMILY_WORDS.relationship)) secondaryTopic = "relationships";
  if (hasAny(tokenSet, FAMILY_WORDS.family) && !secondaryTopic) secondaryTopic = "family";

  let concern: string | null = null;
  if (intent === "support_other" || phraseHas(t, ["going through", "worried about", "supporting"])) {
    concern = subject ? `supporting_${subject}` : "supporting_someone";
  }

  // Prefer family subject when both sister + husband appear
  if (tokenSet.has("sister") && tokenSet.has("husband")) {
    subject = "sister";
    relationship = "sister";
    secondaryTopic = "relationships";
    concern = "supporting_sister";
  }

  return { subject, relationship, concern, secondaryTopic };
}

/** Soft multilingual / non-latin: still return a coherent fallback, never crash. */
export function isMostlyNonLatin(text: string): boolean {
  // Punctuation-only / emoji-only is not multilingual prose
  if (!/[A-Za-z\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text)) {
    return false;
  }
  const letters = text.replace(/\s/g, "");
  if (!letters.length) return false;
  const latin = (letters.match(/[a-zA-Z]/g) || []).length;
  return latin / letters.length < 0.35 && letters.length >= 2;
}
