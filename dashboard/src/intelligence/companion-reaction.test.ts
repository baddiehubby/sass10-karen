import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompanionReaction,
  ephemeralMediaContext,
  hasPaidCompanionReactionAccess,
} from "../../lib/companion-reaction.server";

test("explicit mood has higher confidence than voluntarily shared media", () => {
  const explicit = buildCompanionReaction(
    { source: "explicit_mood", mood: "happy" },
    { seed: "explicit-test" },
  );
  const media = buildCompanionReaction(
    { source: "media", title: "A bright morning song", text: "Upbeat and warm" },
    { seed: "media-test" },
  );

  assert.equal(explicit.mood, "happy");
  assert.equal(explicit.confidenceBand, "high");
  assert.equal(explicit.basis, "user-stated-mood");
  assert.equal(media.confidenceBand, "low");
  assert.equal(media.basis, "shared-media-context");
  assert.ok(explicit.confidence > media.confidence);
  assert.match(media.disclaimer, /interpretation|not a reading/i);
});

test("ephemeral media context is sanitized and bounded", () => {
  const context = ephemeralMediaContext({
    title: ` Song\u0000Title ${"x".repeat(400)}`,
    text: `line one\nline two ${"y".repeat(400)}`,
  });

  assert.ok(context.length <= 420);
  assert.doesNotMatch(context, /[\u0000-\u001F\u007F]/);
  assert.match(context, /Song Title/);
});

test("reaction and presence work remain paid-only", () => {
  assert.equal(hasPaidCompanionReactionAccess(undefined), false);
  assert.equal(hasPaidCompanionReactionAccess({ hasPaidAccess: false }), false);
  assert.equal(hasPaidCompanionReactionAccess({ hasPaidAccess: true }), true);
});
