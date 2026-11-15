/**
 * Re-export canonical bridge (TalkingHead + ARKit).
 * Prefer importing from `@/lib/karen/expression-bridge`.
 */
export {
  applyExpressionToTalkingHead,
  getBlendshapes,
  mapChatMoodToTalkingHead,
  normalizeMood,
  parseMoodTag,
  speakingJawOpen,
  stripMoodTags,
  triggerKarenFaceFromReply,
  triggerKarenLipSync,
  type ArkitBlendshapes,
  type KarenExpressionMood,
  type TalkingHeadLike,
  type TalkingHeadMoodName,
} from "@/lib/karen/expression-bridge";
