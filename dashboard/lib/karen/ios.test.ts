import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { IOS_APPLE_TAX_BODY, isIOSDevice } from "./ios";

describe("isIOSDevice", () => {
  it("detects iPhone / iPad user agents", () => {
    assert.equal(
      isIOSDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
      true,
    );
    assert.equal(
      isIOSDevice(
        "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
      true,
    );
  });

  it("rejects desktop Chrome", () => {
    assert.equal(
      isIOSDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
      ),
      false,
    );
  });

  it("ships the Apple-tax web-subscribe copy", () => {
    assert.match(IOS_APPLE_TAX_BODY, /30% tax/i);
    assert.match(IOS_APPLE_TAX_BODY, /save \$5/i);
  });
});
