// Правила зрізу WS6 (openspec/specs/workflow-runs, openspec/specs/run-tasks) — чисті функції без бази.
// Server actions викликають їх до звернення до Supabase; ті самі права й обмеження дублює база (RLS, check, функції).

export type Role = "manager" | "admin";

export type Actor = { id: string; role: Role };

export const CASE_NAME_MAX = 100;
export const MSG_EMPTY_CASE_NAME = "Enter a case name";
export const MSG_CASE_NAME_TOO_LONG = "Case name must be at most 100 characters";

export type CaseNameResult = { ok: true; value: string } | { ok: false; error: string };

// AC-RUN-03, AC-RUN-07. Довжину рахуємо в символах Unicode за введеним текстом (design.md, D4);
// зберігаємо назву без пробілів по краях.
export function validateCaseName(raw: string): CaseNameResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, error: MSG_EMPTY_CASE_NAME };
  if (Array.from(raw).length > CASE_NAME_MAX) return { ok: false, error: MSG_CASE_NAME_TOO_LONG };
  return { ok: true, value: trimmed };
}

export type TemplateTask = {
  id: string;
  sectionName: string;
  name: string;
  required: boolean;
  position: number;
};

export type PlannedRunTask = {
  templateTaskId: string;
  sectionName: string;
  name: string;
  required: boolean;
  position: number;
  assigneeId: string;
  status: "to_do";
};

export type PlannedRun = {
  managerId: string;
  caseName: string;
  status: "in_progress";
  tasks: PlannedRunTask[];
};

// AC-RUN-01, AC-RUN-02, AC-RUN-04, AC-RUN-05, AC-RUN-06, AC-RUN-08, AC-RUN-09.
// Запуск — копія задач шаблону (знімок): менеджер запуску — той, хто запускає; виконавець задачі — призначений
// користувач або менеджер запуску.
export function planRun(
  actor: Actor,
  caseName: string,
  templateTasks: readonly TemplateTask[],
  assignments: Readonly<Record<string, string>> = {},
): { ok: true; run: PlannedRun } | { ok: false; error: string } {
  const name = validateCaseName(caseName);
  if (!name.ok) return name;
  return {
    ok: true,
    run: {
      managerId: actor.id,
      caseName: name.value,
      status: "in_progress",
      tasks: templateTasks.map((t) => ({
        templateTaskId: t.id,
        sectionName: t.sectionName,
        name: t.name,
        required: t.required,
        position: t.position,
        assigneeId: assignments[t.id] || actor.id,
        status: "to_do",
      })),
    },
  };
}
