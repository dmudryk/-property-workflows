import { describe, expect, it } from "vitest";
import {
  MSG_NOT_ALLOWED_TO_MARK,
  canSeeRun,
  markTaskDone,
  progressLabel,
  taskStatusLabel,
  visibleRuns,
  type Actor,
  type Run,
  type RunTask,
} from "./rules";

const managerA: Actor = { id: "manager-a", role: "manager" };
const managerB: Actor = { id: "manager-b", role: "manager" };
const managerC: Actor = { id: "manager-c", role: "manager" };
const admin: Actor = { id: "admin-1", role: "admin" };

// Запуск менеджера A з 5 задачами, 3 обов'язкові (t1, t2, t4); задачу t2 виконує менеджер B.
function runOfA(overrides: Partial<Record<string, Partial<RunTask>>> = {}): Run {
  const tasks: RunTask[] = [
    { id: "t1", assigneeId: managerA.id, required: true, status: "to_do" },
    { id: "t2", assigneeId: managerB.id, required: true, status: "to_do" },
    { id: "t3", assigneeId: managerA.id, required: false, status: "to_do" },
    { id: "t4", assigneeId: managerA.id, required: true, status: "to_do" },
    { id: "t5", assigneeId: managerA.id, required: false, status: "to_do" },
  ].map((t) => ({ ...t, ...overrides[t.id] }) as RunTask);
  return { id: "run-a1", managerId: managerA.id, status: "in_progress", tasks };
}

function statusOf(run: Run, taskId: string) {
  return run.tasks.find((t) => t.id === taskId)?.status;
}

describe("run-tasks", () => {
  it("AC-TASK-01: the assignee marks their task as done", () => {
    const result = markTaskDone(managerB, runOfA(), "t2");

    expect(result.ok).toBe(true);
    expect(statusOf(result.run, "t2")).toBe("done");
  });

  it("AC-TASK-02: the run manager marks another assignee's task of their run as done", () => {
    const result = markTaskDone(managerA, runOfA(), "t2");

    expect(result.ok).toBe(true);
    expect(statusOf(result.run, "t2")).toBe("done");
  });

  it("AC-TASK-03: a manager who is neither the run manager nor the assignee cannot mark the task", () => {
    const run = runOfA();
    const result = markTaskDone(managerC, run, "t2");

    expect(result).toEqual({ ok: false, error: MSG_NOT_ALLOWED_TO_MARK, run });
    expect(statusOf(result.run, "t2")).toBe("to_do");
    expect(MSG_NOT_ALLOWED_TO_MARK).toBe(
      "Only the task's assignee, the run manager, or an administrator can mark a task as done",
    );
  });

  it("AC-TASK-04: marking the third required task as done completes the run", () => {
    const run = runOfA({ t1: { status: "done" }, t2: { status: "done" } });
    expect(run.status).toBe("in_progress");

    const result = markTaskDone(managerA, run, "t4");

    expect(result.ok).toBe(true);
    expect(result.run.status).toBe("completed");
    expect(statusOf(result.run, "t3")).toBe("to_do");
    expect(statusOf(result.run, "t5")).toBe("to_do");
  });

  it("AC-TASK-05: the run page shows the progress 2 of 5 done", () => {
    const run = runOfA({ t1: { status: "done" }, t3: { status: "done" } });

    expect(progressLabel(run.tasks)).toBe("2 of 5 done");
  });

  it("AC-TASK-06: manager B sees their own run and the run where they are an assignee, not the other run of A", () => {
    const firstOfA = runOfA();
    const secondOfA: Run = {
      id: "run-a2",
      managerId: managerA.id,
      status: "in_progress",
      tasks: [{ id: "x1", assigneeId: managerA.id, required: true, status: "to_do" }],
    };
    const ownOfB: Run = {
      id: "run-b1",
      managerId: managerB.id,
      status: "in_progress",
      tasks: [{ id: "y1", assigneeId: managerB.id, required: true, status: "to_do" }],
    };

    const seen = visibleRuns(managerB, [firstOfA, secondOfA, ownOfB]).map((r) => r.id);

    expect(seen).toEqual(["run-a1", "run-b1"]);
    expect(canSeeRun(managerB, secondOfA)).toBe(false);
    expect(visibleRuns(admin, [firstOfA, secondOfA, ownOfB])).toHaveLength(3);
  });

  it("AC-TASK-07: an administrator who did not create the run marks a task as done", () => {
    const result = markTaskDone(admin, runOfA(), "t2");

    expect(result.ok).toBe(true);
    expect(statusOf(result.run, "t2")).toBe("done");
  });

  it("AC-TASK-08: the run manager sees for each of the 5 tasks whether it is done or to do", () => {
    const run = runOfA({ t1: { status: "done" }, t4: { status: "done" } });
    const shown = run.tasks.map((t) => taskStatusLabel(t.status));

    expect(shown).toHaveLength(5);
    expect(shown).toEqual(["done", "to do", "to do", "done", "to do"]);
  });

  it("AC-TASK-09: the list of runs of manager A shows the run with the progress 2 of 5 done", () => {
    const run = runOfA({ t2: { status: "done" }, t5: { status: "done" } });
    const rows = visibleRuns(managerA, [run]).map((r) => ({ id: r.id, progress: progressLabel(r.tasks) }));

    expect(rows).toEqual([{ id: "run-a1", progress: "2 of 5 done" }]);
  });
});
