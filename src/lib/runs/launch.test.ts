import { describe, expect, it } from "vitest";
import {
  MSG_CASE_NAME_TOO_LONG,
  MSG_EMPTY_CASE_NAME,
  planRun,
  type Actor,
  type TemplateTask,
} from "./rules";

// Шаблон «Tenant move-in»: 2 секції, 5 задач, 3 обов'язкові (AC-RUN-01).
function tenantMoveIn(): TemplateTask[] {
  return [
    { id: "t1", sectionName: "Before move-in", name: "Sign the lease", required: true, position: 1 },
    { id: "t2", sectionName: "Before move-in", name: "Collect the deposit", required: true, position: 2 },
    { id: "t3", sectionName: "Before move-in", name: "Order cleaning", required: false, position: 3 },
    { id: "t4", sectionName: "Move-in day", name: "Hand over the keys", required: true, position: 4 },
    { id: "t5", sectionName: "Move-in day", name: "Read the meters", required: false, position: 5 },
  ];
}

const managerA: Actor = { id: "manager-a", role: "manager" };
const managerB: Actor = { id: "manager-b", role: "manager" };
const admin: Actor = { id: "admin-1", role: "admin" };

function launched(actor: Actor, caseName: string, assignments: Record<string, string> = {}) {
  const result = planRun(actor, caseName, tenantMoveIn(), assignments);
  if (!result.ok) throw new Error(`expected a run, got: ${result.error}`);
  return result.run;
}

describe("workflow-runs", () => {
  it("AC-RUN-01: launching a template creates one run in progress with all 5 tasks to do", () => {
    const template = tenantMoveIn();
    expect(new Set(template.map((t) => t.sectionName)).size).toBe(2);
    expect(template.filter((t) => t.required)).toHaveLength(3);

    const result = planRun(managerA, "Apartment 12, move-in", template);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.status).toBe("in_progress");
    expect(result.run.tasks).toHaveLength(5);
    expect(result.run.tasks.every((t) => t.status === "to_do")).toBe(true);
  });

  it("AC-RUN-02: changing the template after launch does not change the run", () => {
    const template = tenantMoveIn();
    const result = planRun(managerA, "Apartment 12, move-in", template);
    if (!result.ok) throw new Error(result.error);

    template[0].name = "Sign the lease (v2)";
    template.push({ id: "t6", sectionName: "Move-in day", name: "Welcome pack", required: false, position: 6 });

    expect(result.run.tasks).toHaveLength(5);
    expect(result.run.tasks.map((t) => t.name)).toEqual([
      "Sign the lease",
      "Collect the deposit",
      "Order cleaning",
      "Hand over the keys",
      "Read the meters",
    ]);
  });

  it("AC-RUN-03: an empty case name or one of only spaces creates no run", () => {
    for (const caseName of ["", "   "]) {
      const result = planRun(managerA, caseName, tenantMoveIn());
      expect(result).toEqual({ ok: false, error: MSG_EMPTY_CASE_NAME });
    }
    expect(MSG_EMPTY_CASE_NAME).toBe("Enter a case name");
  });

  it("AC-RUN-04: two tasks assigned to manager B, the remaining 3 to manager A", () => {
    const run = launched(managerA, "Apartment 12, move-in", { t2: managerB.id, t4: managerB.id });

    expect(run.tasks.filter((t) => t.assigneeId === managerB.id).map((t) => t.templateTaskId)).toEqual(["t2", "t4"]);
    expect(run.tasks.filter((t) => t.assigneeId === managerA.id)).toHaveLength(3);
  });

  it("AC-RUN-05: an administrator launches a template and is the run manager", () => {
    const run = launched(admin, "Apartment 14, move-in");

    expect(run.managerId).toBe(admin.id);
    expect(run.caseName).toBe("Apartment 14, move-in");
  });

  it("AC-RUN-06: manager A launches a template and is the run manager", () => {
    const run = launched(managerA, "Apartment 12, move-in");

    expect(run.managerId).toBe(managerA.id);
  });

  it("AC-RUN-07: a case name of 101 characters creates no run", () => {
    const result = planRun(managerA, "a".repeat(101), tenantMoveIn());

    expect(result).toEqual({ ok: false, error: MSG_CASE_NAME_TOO_LONG });
    expect(MSG_CASE_NAME_TOO_LONG).toBe("Case name must be at most 100 characters");
    expect(planRun(managerA, "a".repeat(100), tenantMoveIn()).ok).toBe(true);
  });

  it("AC-RUN-08: manager A without assignments is the assignee of all 5 tasks", () => {
    const run = launched(managerA, "Apartment 12, move-in");

    expect(run.tasks).toHaveLength(5);
    expect(run.tasks.every((t) => t.assigneeId === managerA.id)).toBe(true);
  });

  it("AC-RUN-09: an administrator without assignments is the assignee of all 5 tasks", () => {
    const run = launched(admin, "Apartment 14, move-in");

    expect(run.tasks).toHaveLength(5);
    expect(run.tasks.every((t) => t.assigneeId === admin.id)).toBe(true);
  });
});
