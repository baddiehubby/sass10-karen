import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  KAREN_FAITH_SHATTER_CTA,
  KAREN_FAITH_SHATTER_FOOTNOTE,
  KAREN_FAITH_SHATTER_HEADLINE,
  KAREN_FAITH_SHATTER_PRICE_LABEL,
  KAREN_FAITH_SHATTER_SUBTEXT,
  KAREN_FREE_MESSAGE_LIMIT,
  KAREN_UNLOCK_CTA,
  KAREN_VIP_ACCOUNTABILITY_CTA,
  KAREN_VIP_LOCKED_MODAL,
  KAREN_VIP_PRICE_LABEL,
  KAREN_VIP_UPGRADE_MESSAGE,
  karenFreeMessagesUsedToday,
  utcDayKey,
} from "./vip";

describe("Karen VIP $19/mo monetization helpers", () => {
  it("prices VIP as a monthly subscription", () => {
    assert.equal(KAREN_VIP_PRICE_LABEL, "$19/month");
    assert.match(KAREN_VIP_UPGRADE_MESSAGE, /\$19/);
    assert.match(KAREN_UNLOCK_CTA, /\$19/);
    assert.match(KAREN_VIP_ACCOUNTABILITY_CTA, /\$19\/month/);
    assert.match(KAREN_VIP_LOCKED_MODAL, /Pay the \$19/);
  });

  it("frames Faith Shatter as a $20 Prove Your Worth challenge", () => {
    assert.equal(KAREN_FAITH_SHATTER_HEADLINE, "YOU FAILED THE VIP TEST.");
    assert.equal(KAREN_FAITH_SHATTER_PRICE_LABEL, "$20/month");
    assert.match(KAREN_FAITH_SHATTER_SUBTEXT, /\$20\/month/);
    assert.match(KAREN_FAITH_SHATTER_SUBTEXT, /spine/i);
    assert.equal(KAREN_FAITH_SHATTER_CTA, "Accept the Challenge ($20)");
    assert.match(KAREN_FAITH_SHATTER_FOOTNOTE, /NO REFUNDS/i);
    assert.match(KAREN_FAITH_SHATTER_FOOTNOTE, /Dajjal/i);
  });

  it("resets free count when the UTC day changes", () => {
    const today = utcDayKey();
    assert.equal(
      karenFreeMessagesUsedToday({ karenChatCount: 3, karenChatDay: today }),
      3,
    );
    assert.equal(
      karenFreeMessagesUsedToday({ karenChatCount: 3, karenChatDay: "2000-01-01" }),
      0,
    );
    assert.equal(KAREN_FREE_MESSAGE_LIMIT, 3);
  });
});
