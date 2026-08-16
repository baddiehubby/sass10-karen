import type { BuddyTopic } from "@/src/intelligence/types";

/**
 * Lightweight topic state machine — tracks sticky topic across turns.
 */
export type TopicState = {
  current: BuddyTopic;
  previous: BuddyTopic;
  stickyUntil: number;
};

export function createTopicState(initial: BuddyTopic = "none"): TopicState {
  return { current: initial, previous: "none", stickyUntil: 0 };
}

export function advanceTopic(state: TopicState, next: BuddyTopic, depth: number): TopicState {
  if (next === "none" || next === "buddy") {
    if (state.stickyUntil > depth) return state;
    return { ...state, previous: state.current, current: next === "buddy" ? state.current : next };
  }
  if (next === state.current) {
    return { ...state, stickyUntil: depth + 2 };
  }
  return {
    previous: state.current,
    current: next,
    stickyUntil: depth + 2,
  };
}

export function resolveTopic(routed: BuddyTopic, state: TopicState): BuddyTopic {
  if (routed !== "none" && routed !== "buddy") return routed;
  if (state.current !== "none") return state.current;
  return routed;
}
