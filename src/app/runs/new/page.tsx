import Link from "next/link";
import { launchRun } from "../actions";
import { staffLabel } from "@/lib/runs/rules";
import { requireActor } from "../actor";
import { LAUNCH_ERRORS, messageFor } from "../messages";

// Запуск шаблону для випадку (AC-RUN-01…09): шаблон → назва випадку → виконавці задач (за замовчуванням — менеджер
// запуску, тобто «me»).
export default async function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  const { supabase, actor } = await requireActor();
  const { template, error } = await searchParams;
  const templateId = typeof template === "string" ? template : "";
  const message = messageFor(LAUNCH_ERRORS, error);

  const { data: templates } = await supabase.from("templates").select("id, name").order("name");

  const { data: tasks } = templateId
    ? await supabase
        .from("template_tasks")
        .select("id, name, required, position, template_sections(name, position)")
        .eq("template_id", templateId)
    : { data: null };

  const { data: staff } = templateId ? await supabase.rpc("list_staff") : { data: null };
  const others = (staff ?? []).filter((member) => member.id !== actor?.id);

  const sorted = (tasks ?? []).toSorted(
    (a, b) =>
      (a.template_sections?.position ?? 0) - (b.template_sections?.position ?? 0) || a.position - b.position,
  );

  return (
    <main className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Launch a template</h1>
        <Link href="/runs" className="text-sm underline">
          Back to runs
        </Link>
      </div>

      <form method="get" className="flex items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Template
          <select
            name="template"
            defaultValue={templateId}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              Choose a template
            </option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
          Select
        </button>
      </form>

      {templateId && sorted.length > 0 ? (
        <form action={launchRun} className="flex flex-col gap-4">
          <input type="hidden" name="template_id" value={templateId} />
          <label className="flex flex-col gap-1 text-sm">
            Case name
            <input
              name="case_name"
              placeholder="Apartment 12, move-in"
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Assignees</legend>
            {sorted.map((task) => (
              <label key={task.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="text-zinc-500">{task.template_sections?.name} · </span>
                  {task.name}
                </span>
                <select
                  name={`assignee:${task.id}`}
                  defaultValue=""
                  className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">Me (run manager)</option>
                  {others.map((member) => (
                    <option key={member.id} value={member.id}>
                      {staffLabel(member)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>

          {message ? (
            <p role="alert" className="text-sm text-red-600">
              {message}
            </p>
          ) : null}

          <button type="submit" className="self-start rounded bg-foreground px-4 py-2 font-medium text-background">
            Launch
          </button>
        </form>
      ) : message ? (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      ) : null}
    </main>
  );
}
