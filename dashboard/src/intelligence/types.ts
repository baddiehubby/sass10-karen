/**
 * Buddie local intelligence — $0 inference.
 * Deterministic companion composition, not an LLM.
 */

export type BuddyEmotion =
  | "neutral"
  | "low"
  | "heavy"
  | "anxious"
  | "frustrated"
  | "excited"
  | "warm"
  | "tired"
  | "bored"
  | "grateful"
  | "lonely"
  | "playful"
  | "exhausted"
  | "calm"
  | "curious";

export type BuddyIntent =
  | "greeting"
  | "farewell"
  | "emotional_checkin"
  | "loneliness"
  | "sadness"
  | "frustration"
  | "excitement"
  | "anxiety"
  | "boredom"
  | "celebration"
  | "encouragement"
  | "daily_routine"
  | "work"
  | "study"
  | "relationships"
  | "family"
  | "friendship"
  | "goals"
  | "motivation"
  | "reflection"
  | "gratitude"
  | "silence"
  | "short_answer"
  | "follow_up"
  | "memory_reference"
  | "ask_opinion"
  | "uncertainty"
  | "tired"
  | "emotional_exhaustion"
  | "im_fine"
  | "repair"
  | "repeat"
  | "correction"
  | "smalltalk"
  | "orb_touch"
  | "support_other"
  | "calm"
  | "playfulness"
  | "curiosity"
  | "small_win"
  | "setback"
  | "returning";

export type BuddyTopic =
  | "none"
  | "self"
  | "work"
  | "study"
  | "relationships"
  | "family"
  | "friendship"
  | "goals"
  | "day"
  | "rest"
  | "celebration"
  | "memory"
  | "buddy";

export type CharacterVoice = "chill" | "playful" | "warm" | "mystical" | "focused";

export type EngagementState =
  | "opening"
  | "warming"
  | "deep"
  | "repairing"
  | "closing"
  | "quiet";

export type MemorySnippet = {
  id: string;
  kind: "moment" | "mood" | "note";
  text: string;
  createdAt?: string;
};

/** Structured memory candidate — never persist ambiguous guesses. */
export type MemoryCategory =
  | "relationship"
  | "work"
  | "self"
  | "goal"
  | "place"
  | "study"
  | "other";

export type MemoryCandidate = {
  category: MemoryCategory;
  subject: string;
  relationship: string | null;
  topic: string;
  fact: string;
  relevance: number;
  confidence: number;
  source: "user_statement";
  createdAt: string;
};

export type ConversationTurn = {
  role: "user" | "buddy";
  text: string;
  intent?: BuddyIntent;
  at: string;
};

/** Full tracked conversation machine (internal). */
export type ConversationMachineState = {
  conversationId: string;
  topic: BuddyTopic;
  subtopic: string | null;
  emotionalTone: BuddyEmotion;
  conversationDepth: number;
  userIntent: BuddyIntent;
  lastUserMessage: string;
  lastBuddieResponse: string;
  recentTopics: BuddyTopic[];
  recentResponseFamilies: string[];
  memoryReferences: string[];
  userCorrections: number;
  engagementState: EngagementState;
};

/** Compact per-turn internal state. */
export type InternalTurnState = {
  topic: BuddyTopic;
  intent: BuddyIntent;
  emotion: BuddyEmotion;
  depth: number;
  continuity: number;
  novelty: number;
  confidence: number;
};

export type EntityFrame = {
  subject: string | null;
  relationship: string | null;
  concern: string | null;
  secondaryTopic: BuddyTopic | null;
};

export type IntelligenceInput = {
  userText: string;
  characterVoice?: CharacterVoice;
  companionName?: string;
  conversationDepth?: number;
  conversationId?: string;
  recentTurns?: ConversationTurn[];
  memoryContext?: MemorySnippet[];
  /** Already-persisted high-confidence memories only. */
  persistedMemories?: MemoryCandidate[];
  responseHistory?: string[];
  recentFamilies?: string[];
  recentTopics?: BuddyTopic[];
  userCorrections?: number;
  previousMachine?: ConversationMachineState;
  seed?: string;
  device?: DeviceCapabilities;
};

export type DeviceCapabilities = {
  reducedMotion?: boolean;
  lowPower?: boolean;
  online?: boolean;
};

export type RoutedContext = {
  intent: BuddyIntent;
  emotion: BuddyEmotion;
  topic: BuddyTopic;
  subtopic: string | null;
  depth: number;
  confidence: number;
  continuity: number;
  novelty: number;
  memoryContext: MemorySnippet[];
  persistedMemories: MemoryCandidate[];
  responseHistory: string[];
  recentFamilies: string[];
  characterVoice: CharacterVoice;
  companionName: string;
  userText: string;
  isRepeat: boolean;
  isCorrection: boolean;
  isShort: boolean;
  seed: string;
  entity: EntityFrame;
  engagementState: EngagementState;
  /** Only true when citing a real persisted memory. */
  mayCiteMemory: boolean;
  /** Fired router signal ids (debug / quality). */
  signals: string[];
};

export type ComposedReply = {
  text: string;
  intent: BuddyIntent;
  emotion: BuddyEmotion;
  topic: BuddyTopic;
  depth: number;
  familyId: string;
  orbCue: "idle" | "listening" | "thinking" | "responding" | "comforting" | "excited" | "playful" | "curious";
  source: "local-intelligence";
  /** Explicit: not an LLM completion. */
  inference: "none";
};

export type IntelligenceResult = ComposedReply & {
  routed: RoutedContext;
  conversation: ConversationMachineState;
  turn: InternalTurnState;
  /** High-confidence only — safe to persist. */
  memoryToPersist: MemoryCandidate[];
  /** Ambiguous candidates — do not store permanently. */
  memoryRejected: MemoryCandidate[];
};
