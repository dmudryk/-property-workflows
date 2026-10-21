import Link from "next/link";
import {
  MSG_CANNOT_UNDO,
  MSG_RUN_NOT_FOUND,
  canMarkDone,
  groupBySection,
  needsConfirmation,
  progressLabel,
  requiredLabel,
  runStatusLabel,
  staffLabel,
  taskStatusLabel,
} from "@/lib/runs/rules";
import { markDone } from "../actions";
import { requireActor } from "../actor";
import { RUN_ERRORS, messageFor } from "../messages";

// Сторінка запуску: прогрес «N of M done» (AC-TASK-05), задачі групами за секціями (AC-TASK-12) з email виконавця
// (AC-TASK-11), статусом (AC-TASK-08) і позначкою «required»/«optional» (AC-TASK-15). «Mark as done» — лише тому, хто
// може позначити задачу (AC-TASK-18); остання обов'язкова — з підтвердженням (AC-TASK-04, AC-TASK-16). Права перевіряє
// й база, відмова — повідомлення AC-TASK-03. Запуск, якого користувач не бачить (RLS), — «Run not found» (AC-TASK-10).
export default async function RunPage({ params, searchParams }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const { error, confirm } = await searchParams;
  const message = messageFor(RUN_ERRORS, error);
  const { supabase, actor } = await requireActor();

  const { data: run } = await supabase
    .from("runs")
    .select("id, case_name, template_name, status, manager_id")
    .eq("id", id)
    .maybeSingle();
  if (!run) {
    return (
      <main className="flex flex-col gap-4">
        <Link href="/runs" className="text-sm underline">
          Back to runs
        </Link>
        <p role="alert" data-testid="run-not-found" className="text-lg font-medium">
          {MSG_RUN_NOT_FOUND}
        </p>
      </main>
    );
  }

  const [{ data: rows }, { data: staff }] = await Promise.all([
    supabase
      .from("run_tasks")
      .select("id, section_name, name, required, position, assignee_id, status")
      .eq("run_id", id)
      .order("position"),
    supabase.rpc("list_staff"),
  ]);
  const people = new Map((staff ?? []).map((member) => [member.id, member]));
  const tasks = (rows ?? []).map((t) => ({ ...t, sectionName: t.section_name }));
  const sections = groupBySection(tasks);

  const confirmTask =
    typeof confirm === "string"
      ? tasks.find(
          (t) =>
            t.id === confirm &&
            needsConfirmation(
              tasks.map((x) => ({ id: x.id, required: x.required, status: x.status as "to_do" | "done" })),
              t.id,
            ),
        )
      : undefined;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/runs" className="text-sm underline">
          Back to runs
        </Link>
        <h1 className="text-2xl font-semibold">{run.case_name}</h1>
        <p className="text-sm text-zinc-500">
          {run.template_name} · <span data-testid="run-status">{runStatusLabel(run.status)}</span> · run manager:{" "}
          <span data-testid="run-manager">{staffLabel(people.get(run.manager_id))}</span>
        </p>
        <p data-testid="run-progress" className="text-lg font-medium">
          {progressLabel(tasks)}
        </p>
      </div>

      {message ? (
        <p role="alert" className="rounded border border-red-300 px-4 py-2 text-sm text-red-600">
          {message}
        </p>
      ) : null}

      {confirmTask ? (
        <div
          role="alertdialog"
          data-testid="confirm-done"
          className="flex flex-col gap-3 rounded border border-amber-400 px-4 py-3"
        >
          <p className="font-medium">Mark &quot;{confirmTask.name}&quot; as done?</p>
          <p className="text-sm">{MSG_CANNOT_UNDO}</p>
          <div className="flex gap-3">
            <form action={markDone}>
              <input type="hidden" name="run_id" value={run.id} />
              <input type="hidden" name="task_id" value={confirmTask.id} />
              <input type="hidden" name="confirmed" value="1" />
              <button type="submit" className="rounded bg-foreground px-3 py-1 text-sm text-background">
                Confirm
              </button>
            </form>
            <Link href={`/runs/${run.id}`} className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
              Cancel
            </Link>
          </div>
        </div>
      ) : null}

      {sections.map((section) => (
        <section key={section.name} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-zinc-500">{section.name}</h2>
          <ul className="flex flex-col divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {section.tasks.map((task) => (
              <li
                key={task.id}
                data-testid="run-task"
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <span>{task.name}</span>
                <span data-testid="task-assignee" className="text-sm text-zinc-500">
                  {staffLabel(people.get(task.assignee_id))}
                </span>
                <span className="flex items-center gap-3">
                  <span data-testid="task-required" className="text-xs text-zinc-500">
                    {requiredLabel(task.required)}
                  </span>
                  <span data-testid="task-status" className="text-sm">
                    {taskStatusLabel(task.status)}
                  </span>
                  {task.status === "to_do" &&
                  actor &&
                  canMarkDone(actor, { managerId: run.manager_id }, { assigneeId: task.assignee_id }) ? (
                    <form action={markDone}>
                      <input type="hidden" name="run_id" value={run.id} />
                      <input type="hidden" name="task_id" value={task.id} />
                      <button
                        type="submit"
                        className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
                      >
                        Mark as done
                      </button>
                    </form>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
