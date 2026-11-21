import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPlannerFailInsult,
  isPlannerTaskOverdue,
  KAREN_PLANNER_KEY,
  PLANNER_FAILED_TASK_QUERY,
  plannerFailedTaskHref,
  readFailedTaskFromSearch,
  type PlannerTask,
  urlRequestsPlannerExcuse,
} from "./planner";

describe("toxic planner", () => {
  it("uses karen_planner storage key", () => {
    assert.equal(KAREN_PLANNER_KEY, "karen_planner");
    assert.equal(PLANNER_FAILED_TASK_QUERY, "failedTask");
  });

  it("flags overdue open tasks", () => {
    const task: PlannerTask = {
      id: "1",
      task: "gym",
      deadline: new Date(Date.now() - 60_000).toISOString(),
      completed: false,
    };
    assert.equal(isPlannerTaskOverdue(task), true);
    assert.equal(isPlannerTaskOverdue({ ...task, completed: true }), false);
  });

  it("builds a task-specific insult", () => {
    const line = buildPlannerFailInsult("send the invoice");
    assert.match(line, /send the invoice/);
    assert.match(line, /deadline/i);
  });

  it("routes Face the consequences via failedTask query", () => {
    const href = plannerFailedTaskHref({
      id: "1",
      task: "Go to the gym",
      deadline: new Date().toISOString(),
      completed: false,
    });
    assert.match(href, /^\/karen\?failedTask=/);
    assert.equal(
      readFailedTaskFromSearch(href.replace("/karen", "")),
      "Go to the gym",
    );
    assert.equal(urlRequestsPlannerExcuse(href.replace("/karen", "")), true);
  });
});
