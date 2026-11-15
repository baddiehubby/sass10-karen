import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  karenSystemPrompt,
  parseKarenChatResponse,
  stripPartialKarenTag,
} from "@/lib/karen/sass10-prompt";

describe("Karen prompts — Sweet free vs Sarcasm 10 VIP", () => {
  it("free prompt is sweet / low sarcasm", () => {
    const p = karenSystemPrompt(false);
    assert.match(p, /sweet|demo|low sarcasm/i);
    assert.doesNotMatch(p, /Level 10 Sarcasm/);
  });

  it("premium prompt is Sarcasm 10", () => {
    const p = karenSystemPrompt(true);
    assert.match(p, /Level 10 Sarcasm/);
  });

  it("free parses SWEET and collapses SARCASTIC", () => {
    const sweet = parseKarenChatResponse("[SWEET] Nice try — gently.", { isPremium: false });
    assert.equal(sweet.mood, "SWEET");
    const roast = parseKarenChatResponse("[SARCASTIC] Oh genius.", { isPremium: false });
    assert.equal(roast.mood, "SWEET");
  });

  it("premium parses SARCASTIC / ANGRY / PROUD", () => {
    assert.equal(
      parseKarenChatResponse("[SARCASTIC] Oh, brilliant idea, genius.", { isPremium: true }).mood,
      "SARCASTIC",
    );
    assert.equal(parseKarenChatResponse("[ANGRY] Get up.", { isPremium: true }).mood, "ANGRY");
  });
});

describe("stripPartialKarenTag", () => {
  it("hides incomplete tag while streaming", () => {
    const mid = stripPartialKarenTag("[SARCAS");
    assert.equal(mid.reply, "");
    assert.equal(mid.mood, null);
  });

  it("exposes reply after a complete tag", () => {
    const done = stripPartialKarenTag("[SARCASTIC] Wow,");
    assert.equal(done.mood, "SARCASTIC");
    assert.equal(done.reply, "Wow,");
  });
});
