import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accountabilitySyncFailure,
  accountabilitySyncNote,
  classifyAccountabilitySyncError,
} from "./accountability-sync";

describe("accountability sync error classification", () => {
  it("maps missing column/table to not_migrated", () => {
    assert.equal(classifyAccountabilitySyncError({ code: "P2022" }), "not_migrated");
    assert.equal(classifyAccountabilitySyncError({ code: "P2021" }), "not_migrated");
    assert.equal(
      classifyAccountabilitySyncError(
        new Error('column "karenAccountabilityJson" of relation "User" does not exist'),
      ),
      "not_migrated",
    );
  });

  it("maps connection problems to db_unreachable", () => {
    assert.equal(classifyAccountabilitySyncError({ code: "P1001" }), "db_unreachable");
    const init = Object.assign(new Error("Can't reach database server at `127.0.0.1:55432`"), {
      name: "PrismaClientInitializationError",
    });
    assert.equal(classifyAccountabilitySyncError(init), "db_unreachable");
    assert.equal(
      classifyAccountabilitySyncError(new Error("Environment variable not found: DATABASE_URL")),
      "db_unreachable",
    );
  });

  it("falls back to unknown and never leaks the raw message to the client", () => {
    assert.equal(classifyAccountabilitySyncError(new Error("boom")), "unknown");
    assert.equal(classifyAccountabilitySyncError(null), "unknown");
    const f = accountabilitySyncFailure("db_unreachable");
    assert.equal(f.ok, false);
    assert.doesNotMatch(f.error, /127\.0\.0\.1|postgres|DATABASE_URL/i);
  });

  it("produces honest status notes", () => {
    assert.match(accountabilitySyncNote("guest"), /this device only/);
    assert.match(accountabilitySyncNote({ ok: true }), /Synced/);
    assert.match(
      accountabilitySyncNote(accountabilitySyncFailure("not_migrated")),
      /this device only/,
    );
  });
});
