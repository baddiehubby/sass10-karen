/**
 * Expand data/audio-manifest.json → v2 scalable keyword arrays + categories.
 * Run: node scripts/expand-audio-manifest.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "data", "audio-manifest.json");
const old = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const sb = (n) => `smackbacks/sb_${String(n).padStart(2, "0")}.wav`;
const angry = (n) => `smackbacks/angry_${String(n).padStart(2, "0")}.wav`;
const allSb = Array.from({ length: 50 }, (_, i) => sb(i + 1));
const allAngry = Array.from({ length: 10 }, (_, i) => angry(i + 1));

const pools = {
  insult: [sb(12), sb(15), sb(46), sb(8), sb(17), angry(1), angry(2), angry(3)],
  volume: [
    sb(28),
    sb(5),
    sb(19),
    sb(4),
    sb(14),
    "smackbacks/volume_interrupt.wav",
    angry(4),
  ],
  fight: [sb(25), sb(21), sb(41), sb(36), sb(43), angry(5), angry(6)],
  weak: [sb(8), sb(3), sb(31), sb(44), "smackbacks/dominance_01.wav", angry(7)],
  lie: [sb(7), sb(42), sb(35), sb(39), angry(8)],
  trash: [sb(46), sb(45), sb(30), sb(9), angry(9)],
  shut: [sb(5), sb(38), sb(11), "smackbacks/volume_interrupt.wav", angry(10)],
  karen: [sb(27), sb(22), sb(23), sb(48)],
  excuse: [sb(29), sb(6), sb(18), sb(40)],
  joke: [sb(42), sb(1), sb(2), sb(26)],
  win: [sb(21), sb(25), sb(41), sb(49)],
  aura: [sb(9), sb(24), sb(33), sb(16)],
  hate: [sb(48), sb(47), sb(34), sb(50)],
  done: [sb(38), "smackbacks/done_listening.wav", sb(11), sb(20)],
  mad: [sb(23), ...allAngry.slice(0, 5), sb(47)],
};

const keywordGroups = [
  [
    [
      "stupid",
      "dumb",
      "idiot",
      "moron",
      "fool",
      "braindead",
      "dense",
      "clueless",
      "airhead",
      "nincompoop",
      "dimwit",
      "doofus",
      "nitwit",
      "simpleton",
      "blockhead",
    ],
    pools.insult,
  ],
  [
    [
      "robot",
      "ai",
      "machine",
      "bot",
      "algorithm",
      "chatgpt",
      "llm",
      "software",
      "program",
      "npc",
    ],
    pools.insult,
  ],
  [
    [
      "trash",
      "garbage",
      "mid",
      "worthless",
      "pathetic",
      "useless",
      "garbage tier",
      "bottom",
      "scrap",
    ],
    pools.trash,
  ],
  [
    [
      "shut up",
      "stfu",
      "quiet",
      "silence",
      "zip it",
      "be quiet",
      "pipe down",
      "hush",
      "mute yourself",
    ],
    pools.shut,
  ],
  [
    [
      "loud",
      "yell",
      "scream",
      "shout",
      "noise",
      "yelling",
      "screaming",
      "volume",
      "bellow",
    ],
    pools.volume,
  ],
  [
    ["wrong", "lie", "liar", "fake", "cap", "false", "untrue", "bs", "fib"],
    pools.lie,
  ],
  [
    [
      "fight",
      "argue",
      "1v1",
      "versus",
      "vs",
      "battle",
      "duel",
      "scrap",
      "brawl",
      "war",
    ],
    pools.fight,
  ],
  [
    ["cry", "sad", "hurt", "tears", "whine", "baby", "sob", "weep", "sensitive"],
    pools.weak,
  ],
  [["hate", "despise", "loathe", "suck", "sucks", "annoying af"], pools.hate],
  [
    [
      "boring",
      "lame",
      "weak",
      "soft",
      "scared",
      "coward",
      "chicken",
      "wimp",
      "timid",
      "spineless",
      "afraid",
    ],
    pools.weak,
  ],
  [["karen", "manager", "bossy", "annoying", "entitled", "boss"], pools.karen],
  [
    ["respect", "sorry", "please", "apologize", "apology", "forgive"],
    [sb(22), sb(44), sb(11), sb(1)],
  ],
  [
    ["win", "lose", "lost", "beat", "defeat", "winner", "loser", "owned", "rekt"],
    pools.win,
  ],
  [
    ["aura", "delulu", "vibe", "energy", "cringe", "rizz", "sigma", "main character"],
    pools.aura,
  ],
  [
    [
      "busy",
      "tired",
      "later",
      "excuse",
      "can't",
      "cannot",
      "excuses",
      "lazy",
      "procrastinate",
      "skip",
    ],
    pools.excuse,
  ],
  [
    ["kill", "destroy", "ruin", "end you", "threat", "obliterate", "crush", "demolish"],
    pools.fight,
  ],
  [
    ["joke", "funny", "lol", "lmao", "haha", "laugh", "hilarious", "comedy", "joking"],
    pools.joke,
  ],
  [
    ["personality", "nobody", "nothing", "empty", "boring person", "basic", "bland"],
    [sb(17), sb(8), sb(16), sb(9)],
  ],
  [
    ["enough", "done", "stop", "over", "finished", "quit", "bye", "leave"],
    pools.done,
  ],
  [
    ["mad", "angry", "rage", "tantrum", "furious", "pissed", "heated", "fuming"],
    pools.mad,
  ],
  [
    ["im the boss", "i am the boss", "in charge", "my house", "my rules"],
    [sb(21), sb(27), sb(25), angry(2)],
  ],
  [
    ["money", "salary", "pay", "rich", "broke", "poor", "bills"],
    [sb(9), sb(29), sb(45), "smackbacks/dominance_02.wav"],
  ],
  [
    ["gym", "workout", "legs", "cardio", "protein", "gains"],
    [sb(31), sb(40), sb(8), sb(30)],
  ],
  [
    ["tiktok", "viral", "famous", "influencer", "follower", "likes", "views"],
    [sb(33), sb(24), sb(9), sb(16), sb(42)],
  ],
  [
    ["love", "like you", "friend", "nice", "kind", "sweet"],
    [sb(15), sb(48), sb(3), sb(44)],
  ],
  [
    ["help", "please help", "confused", "how do i"],
    [sb(17), sb(11), sb(29), sb(6)],
  ],
  [["wait", "hold on", "one sec", "hang on", "second"], pools.shut],
  [["whatever", "idc", "dont care", "don't care", "meh"], pools.done],
  [
    ["try me", "come at me", "bring it", "lets go", "let's go"],
    pools.fight,
  ],
];

const keywords = {};
for (const [keys, files] of keywordGroups) {
  for (const k of keys) keywords[k] = [...files];
}
for (const [k, v] of Object.entries(old.keywords || {})) {
  if (!keywords[k]) keywords[k] = Array.isArray(v) ? [...v] : [v];
}

const categories = {
  smackbacks: [...allSb, ...allAngry],
  interrupts: [
    { id: "shut_up", file: "smackbacks/volume_interrupt.wav", text: "SHUT UP!" },
    { id: "dont_care", file: "smackbacks/sb_11.wav", text: "I DON'T CARE" },
    { id: "all_day", file: "smackbacks/sb_11.wav", text: "I don't have all day!" },
    { id: "spit", file: "smackbacks/sb_17.wav", text: "Spit it out!" },
    { id: "coward", file: "smackbacks/dominance_01.wav", text: "Coward." },
    {
      id: "noise",
      file: "smackbacks/sb_28.wav",
      text: "Your volume isn't a personality.",
    },
    {
      id: "yelling",
      file: "smackbacks/sb_05.wav",
      text: "Scream louder. Still wrong.",
    },
    {
      id: "buffering",
      file: "smackbacks/sb_13.wav",
      text: "You're not intimidating. You're buffering.",
    },
    {
      id: "done_talk",
      file: "smackbacks/done_listening.wav",
      text: "I'm done listening. Go do laundry.",
    },
    { id: "angry_cut", file: angry(1), text: "Enough. Mic off." },
    { id: "angry_cut_2", file: angry(5), text: "I cut you off. Deal with it." },
    {
      id: "volume",
      file: "smackbacks/volume_interrupt.wav",
      text: "DON'T YOU DARE RAISE YOUR VOICE AT ME!",
    },
  ],
  mute: [
    {
      id: "default",
      file: "mute/mute.wav",
      text: "Watch your mouth. Mic's off until you apologize.",
    },
  ],
  gaslight: [
    {
      id: "gaslight_01",
      file: "smackbacks/dominance_02.wav",
      text: "I literally cannot hear you over the sound of your own failure.",
    },
    {
      id: "gaslight_02",
      file: "smackbacks/sb_11.wav",
      text: "Are you still talking? I zoned out.",
    },
    {
      id: "gaslight_03",
      file: "smackbacks/sb_15.wav",
      text: "Was that supposed to hurt my feelings?",
    },
    {
      id: "gaslight_04",
      file: "smackbacks/sb_08.wav",
      text: "Mid energy. Sit down.",
    },
    {
      id: "gaslight_05",
      file: angry(3),
      text: "Cute theory. Still wrong.",
    },
  ],
  rage: [
    {
      id: "rage_01",
      file: "smackbacks/volume_interrupt.wav",
      text: "AAAAHHH — DON'T YOU DARE RAISE YOUR VOICE AT ME!",
    },
    {
      id: "rage_02",
      file: "smackbacks/sb_11.wav",
      text: "I DON'T HAVE ALL DAY FOR YOUR NOISE!",
    },
    {
      id: "rage_03",
      file: "smackbacks/dominance_02.wav",
      text: "SHUT UP. I'M SCREAMING NOW.",
    },
    ...allAngry.map((f, i) => ({
      id: `rage_angry_${i + 1}`,
      file: f,
      text: "AAAAHHH!",
    })),
  ],
  tiktok_viral: [
    {
      id: "viral_01",
      file: sb(33),
      text: "You're main-character delulu with side-quest lungs.",
    },
    {
      id: "viral_02",
      file: sb(24),
      text: "You opened your mouth and donated aura.",
    },
    {
      id: "viral_03",
      file: sb(9),
      text: "Your aura just filed for bankruptcy.",
    },
    {
      id: "viral_04",
      file: sb(42),
      text: "Was that a roast or a cry for help?",
    },
    {
      id: "viral_05",
      file: sb(16),
      text: "You sound like a notification that won't dismiss.",
    },
    {
      id: "viral_06",
      file: sb(30),
      text: "You're not cooking. You're burning.",
    },
    {
      id: "viral_07",
      file: sb(49),
      text: "Congratulations. You unlocked more judgment.",
    },
    {
      id: "viral_08",
      file: angry(8),
      text: "For the algorithm: you lost.",
    },
  ],
};

const interrupts = { ...(old.interrupts || {}) };
for (const item of categories.interrupts) {
  if (!interrupts[item.id]) {
    interrupts[item.id] = {
      file: item.file,
      text: item.text,
      readyFallback: item.file,
    };
  }
}

const out = {
  version: 2,
  basePath: "/audio",
  notes:
    "Scalable Kokoro routing. keywords → WAV arrays. categories: smackbacks|interrupts|mute|gaslight|rage|tiktok_viral. Re-roll avoids last 10 played (localStorage).",
  categories,
  keywords,
  clips: old.clips,
  interrupts,
  fallbacks: old.fallbacks,
  mute: old.mute,
  garbage: old.garbage,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(out, null, 2)}\n`);
const fileRefs = Object.values(keywords).reduce((n, a) => n + a.length, 0);
console.log(
  JSON.stringify(
    {
      keywords: Object.keys(keywords).length,
      keywordFileRefs: fileRefs,
      categories: Object.keys(categories),
      interruptPool: categories.interrupts.length,
    },
    null,
    2,
  ),
);
