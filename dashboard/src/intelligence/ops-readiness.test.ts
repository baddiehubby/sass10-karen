import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildLogLine, scrubLogValue } from "@/lib/ops/logger";
import { resolveRequestId } from "@/lib/ops/request-id";
import { scrubSentryEvent } from "@/lib/ops/sentry-scrub";

describe("ops: structured logging redaction", () => {
  it("redacts secrets and never embeds password fields", () => {
    const line = buildLogLine({
      msg: "test",
      level: "info",
      route: "/api/auth/login",
      ...({ password: "hunter2", authorization: "Bearer abc" } as object),
    } as Parameters<typeof buildLogLine>[0]);

    assert.match(line, /"msg":"test"/);
    assert.doesNotMatch(line, /hunter2/);
    assert.doesNotMatch(line, /Bearer abc/);
    assert.match(line, /\[redacted\]/);
  });

  it("scrubs nested sensitive keys", () => {
    const scrubbed = scrubLogValue("body", {
      password: "x",
      nested: { apiKey: "y", mood: "happy" },
    }) as Record<string, unknown>;
    assert.equal(scrubbed.password, "[redacted]");
    assert.equal((scrubbed.nested as Record<string, unknown>).apiKey, "[redacted]");
    assert.equal((scrubbed.nested as Record<string, unknown>).mood, "happy");
  });
});

describe("ops: request correlation id", () => {
  it("accepts inbound x-request-id or mints a new id", () => {
    const inbound = resolveRequestId({
      get: (n: string) => (n === "x-request-id" ? "req_test_12345678" : null),
    });
    assert.equal(inbound, "req_test_12345678");

    const minted = resolveRequestId({ get: () => null });
    assert.ok(minted.length >= 8);
  });

  it("rejects malformed inbound ids", () => {
    const minted = resolveRequestId({
      get: (n: string) => (n === "x-request-id" ? "bad id with spaces!" : null),
    });
    assert.notEqual(minted, "bad id with spaces!");
  });
});

describe("ops: sentry scrub", () => {
  it("removes authorization headers from events", () => {
    const scrubbed = scrubSentryEvent({
      request: {
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json",
        },
        data: { password: "nope" },
      },
    });
    assert.ok(scrubbed);
    const headers = (scrubbed!.request as { headers: Record<string, string> }).headers;
    assert.equal(headers.authorization, "[redacted]");
    assert.equal(headers["content-type"], "application/json");
  });
});
