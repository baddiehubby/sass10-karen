/**
 * Toxic Planner — local commitments Karen enforces when deadlines slip.
 * Storage key: `karen_planner` → `{ id, task, deadline, completed }[]`
 */

export const KAREN_PLANNER_KEY = "karen_planner";
/** Deep-link query: `/karen?failedTask=Go%20to%20the%20gym` */
export const PLANNER_FAILED_TASK_QUERY = "failedTask";
/** @deprecated Prefer failedTask query — kept for older session barges. */
export const PLANNER_PENDING_EXCUSE_KEY = "karen.planner.pendingExcuse";
export const PLANNER_EXCUSE_QUERY = "excuse";

export type PlannerTask = {
  id: string;
  /** What the user is avoiding. */
  task: string;
  /** ISO deadline. */
  deadline: string;
  completed: boolean;
};

export type PlannerExcusePayload = {
  taskId: string;
  text: string;
};

function normalizeTask(raw: unknown): PlannerTask | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  // Support legacy `{ text, done }` rows written by earlier builds.
  const task =
    typeof o.task === "string"
      ? o.task
      : typeof o.text === "string"
        ? o.text
        : null;
  const deadline = typeof o.deadline === "string" ? o.deadline : null;
  if (!id || !task || !deadline) return null;
  const completed =
    typeof o.completed === "boolean"
      ? o.completed
      : typeof o.done === "boolean"
        ? o.done
        : false;
  return { id, task, deadline, completed };
}

function safeParseTasks(raw: string | null): PlannerTask[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeTask)
      .filter((t): t is PlannerTask => Boolean(t));
  } catch {
    return [];
  }
}

export function readPlannerTasks(): PlannerTask[] {
  if (typeof window === "undefined") return [];
  try {
    return safeParseTasks(window.localStorage.getItem(KAREN_PLANNER_KEY));
  } catch {
    return [];
  }
}

export function writePlannerTasks(tasks: PlannerTask[]): PlannerTask[] {
  if (typeof window === "undefined") return tasks;
  try {
    window.localStorage.setItem(KAREN_PLANNER_KEY, JSON.stringify(tasks));
  } catch {
    /* private mode / quota */
  }
  return tasks;
}

export function addPlannerTask(input: {
  task: string;
  deadline: string;
}): PlannerTask {
  const taskText = input.task.replace(/\s+/g, " ").trim();
  const row: PlannerTask = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    task: taskText,
    deadline: input.deadline,
    completed: false,
  };
  const next = [row, ...readPlannerTasks()];
  writePlannerTasks(next);
  return row;
}

export function updatePlannerTask(
  id: string,
  patch: Partial<Pick<PlannerTask, "completed" | "task" | "deadline">>,
): PlannerTask[] {
  const next = readPlannerTasks().map((t) =>
    t.id === id ? { ...t, ...patch } : t,
  );
  return writePlannerTasks(next);
}

export function removePlannerTask(id: string): PlannerTask[] {
  return writePlannerTasks(readPlannerTasks().filter((t) => t.id !== id));
}

export function isPlannerTaskOverdue(
  task: PlannerTask,
  now = Date.now(),
): boolean {
  if (task.completed) return false;
  const t = Date.parse(task.deadline);
  if (Number.isNaN(t)) return false;
  return t < now;
}

export function formatPlannerDeadline(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Karen's line when they face the consequences for a failed task. */
export function buildPlannerFailInsult(taskText: string): string {
  const clean =
    taskText.replace(/\s+/g, " ").trim() || "that thing you were avoiding";
  return `You locked in "${clean}" and still blew the deadline. Karen doesn't take excuses — she takes receipts. Explain yourself.`;
}

export function markPlannerExcusePending(payload: PlannerExcusePayload): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PLANNER_PENDING_EXCUSE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    /* ignore */
  }
}

export function consumePlannerExcusePending(): PlannerExcusePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PLANNER_PENDING_EXCUSE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(PLANNER_PENDING_EXCUSE_KEY);
    const parsed = JSON.parse(raw) as PlannerExcusePayload;
    if (!parsed?.text || !parsed?.taskId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readFailedTaskFromSearch(
  search: string | URLSearchParams,
): string | null {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.replace(/^\?/, ""))
      : search;
  const raw = params.get(PLANNER_FAILED_TASK_QUERY);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  return clean || null;
}

export function urlRequestsPlannerExcuse(
  search: string | URLSearchParams,
): boolean {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.replace(/^\?/, ""))
      : search;
  return (
    Boolean(params.get(PLANNER_FAILED_TASK_QUERY)) ||
    params.get(PLANNER_EXCUSE_QUERY) === "1"
  );
}

/** Deep-link into the roast with the failed task in the query string. */
export function plannerFailedTaskHref(task: PlannerTask): string {
  return `/karen?${PLANNER_FAILED_TASK_QUERY}=${encodeURIComponent(task.task)}`;
}
