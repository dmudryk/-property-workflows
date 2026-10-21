import { describe, expect, it } from "vitest";
import {
  MSG_NOT_ALLOWED_TO_MARK,
  canSeeRun,
  markTaskDone,
  MSG_CANNOT_UNDO,
  MSG_RUN_NOT_FOUND,
  canMarkDone,
  groupBySection,
  needsConfirmation,
  newestFirst,
  progressLabel,
  requiredLabel,
  runStatusLabel,
  staffLabel,
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
  it("AC-TASK-01: the assignee marks their task (not the last required one) as done", () => {
    expect(needsConfirmation(runOfA().tasks, "t2")).toBe(false);
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

  it("AC-TASK-04: marking the third required task as done and confirming completes the run", () => {
    const run = runOfA({ t1: { status: "done" }, t2: { status: "done" } });
    expect(run.status).toBe("in_progress");
    expect(needsConfirmation(run.tasks, "t4")).toBe(true);

    const result = markTaskDone(managerA, run, "t4", { confirmed: true });

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

  it("AC-TASK-10: manager C opening a run of A by a direct link sees Run not found and no tasks", () => {
    const run = runOfA();

    expect(canSeeRun(managerC, run)).toBe(false);
    expect(visibleRuns(managerC, [run])).toEqual([]);
    expect(MSG_RUN_NOT_FOUND).toBe("Run not found");
  });

  it("AC-TASK-11: manager B sees the assignee's email next to each task, no names or roles", () => {
    const people = new Map([
      [managerA.id, { email: "manager.a@example.test", full_name: "Менеджер A (демо)", role: "manager" }],
      [managerB.id, { email: "manager.b@example.test", full_name: "Менеджер B (демо)", role: "manager" }],
    ]);
    const shown = runOfA().tasks.map((t) => staffLabel(people.get(t.assigneeId)));

    expect(shown).toEqual([
      "manager.a@example.test",
      "manager.b@example.test",
      "manager.a@example.test",
      "manager.a@example.test",
      "manager.a@example.test",
    ]);
    expect(shown.join(" ")).not.toMatch(/демо|manager$/);
  });

  it("AC-TASK-12: tasks are shown in two groups, Before move-in (2) then Move-in day (3)", () => {
    const tasks = [
      { sectionName: "Move-in day", position: 2001, name: "Hand over the keys" },
      { sectionName: "Before move-in", position: 1001, name: "Sign the lease" },
      { sectionName: "Move-in day", position: 2002, name: "Read the meters" },
      { sectionName: "Before move-in", position: 1002, name: "Collect the deposit" },
      { sectionName: "Move-in day", position: 2003, name: "Order cleaning" },
    ];

    expect(groupBySection(tasks).map((g) => [g.name, g.tasks.length])).toEqual([
      ["Before move-in", 2],
      ["Move-in day", 3],
    ]);
  });

  it("AC-TASK-13: the list shows a completed run as completed with 4 of 5 done next to a run in progress", () => {
    const completed = runOfA({
      t1: { status: "done" },
      t2: { status: "done" },
      t3: { status: "done" },
      t4: { status: "done" },
    });
    const rows = visibleRuns(managerA, [{ ...completed, status: "completed" as const }, runOfA()]).map((r) => [
      runStatusLabel(r.status),
      progressLabel(r.tasks),
    ]);

    expect(rows).toEqual([
      ["completed", "4 of 5 done"],
      ["in progress", "0 of 5 done"],
    ]);
  });

  it("AC-TASK-14: the later Repair run is shown before Tenant move-in, each with case and template name", () => {
    const rows = newestFirst([
      { caseName: "Apartment 12", templateName: "Tenant move-in", createdAt: "2026-10-20T09:00:00Z" },
      { caseName: "Apartment 12", templateName: "Repair", createdAt: "2026-10-20T10:00:00Z" },
    ]).map((r) => `${r.caseName} · ${r.templateName}`);

    expect(rows).toEqual(["Apartment 12 · Repair", "Apartment 12 · Tenant move-in"]);
  });

  it("AC-TASK-15: each task is marked required or optional next to its status: 3 and 2", () => {
    const labels = runOfA().tasks.map((t) => requiredLabel(t.required));

    expect(labels.filter((l) => l === "required")).toHaveLength(3);
    expect(labels.filter((l) => l === "optional")).toHaveLength(2);
  });

  it("AC-TASK-16: cancelling at the confirmation of the last required task keeps it to do and the run in progress", () => {
    const run = runOfA({ t1: { status: "done" }, t4: { status: "done" } });

    const result = markTaskDone(managerB, run, "t2");

    expect(result).toEqual({ ok: false, confirm: true, run });
    expect(statusOf(result.run, "t2")).toBe("to_do");
    expect(result.run.status).toBe("in_progress");
    expect(MSG_CANNOT_UNDO).toBe("This cannot be undone");
  });

  it("AC-TASK-17: manager B, an assignee in the run of A, sees the progress 2 of 5 done in the list", () => {
    const run = runOfA({ t1: { status: "done" }, t3: { status: "done" } });
    const rows = visibleRuns(managerB, [run]).map((r) => ({ id: r.id, progress: progressLabel(r.tasks) }));

    expect(rows).toEqual([{ id: "run-a1", progress: "2 of 5 done" }]);
  });

  it("AC-TASK-18: manager C is offered to mark their own task, not the task of manager B", () => {
    const run = runOfA({ t3: { assigneeId: managerC.id } });
    const offered = run.tasks.filter((t) => canMarkDone(managerC, run, t)).map((t) => t.id);

    expect(offered).toEqual(["t3"]);
    expect(canMarkDone(managerC, run, run.tasks[1])).toBe(false);
  });
});
