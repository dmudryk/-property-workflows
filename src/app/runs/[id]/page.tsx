import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, staffLabel } from "../actor";

const STATUS_LABEL: Record<string, string> = { in_progress: "in progress", completed: "completed" };
const TASK_STATUS_LABEL: Record<string, string> = { to_do: "to do", done: "done" };

// Сторінка запуску: задачі за секціями з виконавцем і статусом. Запуск, якого користувач не бачить (RLS), — 404.
export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const { supabase } = await requireActor();

  const { data: run } = await supabase
    .from("runs")
    .select("id, case_name, template_name, status, manager_id")
    .eq("id", id)
    .maybeSingle();
  if (!run) notFound();

  const [{ data: tasks }, { data: staff }] = await Promise.all([
    supabase
      .from("run_tasks")
      .select("id, section_name, name, required, position, assignee_id, status")
      .eq("run_id", id)
      .order("position"),
    supabase.rpc("list_staff"),
  ]);
  const people = new Map((staff ?? []).map((member) => [member.id, member]));

  const sections: { name: string; tasks: NonNullable<typeof tasks> }[] = [];
  for (const task of tasks ?? []) {
    const last = sections.at(-1);
    if (last && last.name === task.section_name) last.tasks.push(task);
    else sections.push({ name: task.section_name, tasks: [task] });
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/runs" className="text-sm underline">
          Back to runs
        </Link>
        <h1 className="text-2xl font-semibold">{run.case_name}</h1>
        <p className="text-sm text-zinc-500">
          {run.template_name} · <span data-testid="run-status">{STATUS_LABEL[run.status] ?? run.status}</span> · run
          manager: <span data-testid="run-manager">{staffLabel(people.get(run.manager_id))}</span>
        </p>
      </div>

      {sections.map((section) => (
        <section key={section.name} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-zinc-500">{section.name}</h2>
          <ul className="flex flex-col divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {section.tasks.map((task) => (
              <li key={task.id} data-testid="run-task" className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>{task.name}</span>
                <span className="text-sm text-zinc-500">{staffLabel(people.get(task.assignee_id))}</span>
                <span data-testid="task-status" className="text-sm">
                  {TASK_STATUS_LABEL[task.status] ?? task.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
