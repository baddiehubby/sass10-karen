import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  KAREN_FREE_MESSAGE_LIMIT,
  KAREN_VIP_UPGRADE_MESSAGE,
  karenFreeMessagesUsedToday,
  utcDayKey,
} from "./vip";

describe("Karen VIP monetization helpers", () => {
  it("uses the savage 402 copy", () => {
    assert.match(KAREN_VIP_UPGRADE_MESSAGE, /\$19/);
    assert.match(KAREN_VIP_UPGRADE_MESSAGE, /savage/i);
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
