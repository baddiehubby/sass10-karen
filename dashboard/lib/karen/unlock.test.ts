import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { urlSignalsKarenUnlock } from "./unlock";

describe("karen unlock helpers", () => {
  it("detects Lemon success redirect", () => {
    assert.equal(urlSignalsKarenUnlock("?karen=unlocked"), true);
    assert.equal(urlSignalsKarenUnlock("?checkout=cancelled"), false);
  });
});
