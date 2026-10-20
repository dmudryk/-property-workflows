import Link from "next/link";
import { requireActor } from "./actor";

const STATUS_LABEL: Record<string, string> = { in_progress: "in progress", completed: "completed" };

// Список запусків. Які запуски видно — вирішує RLS (private.can_see_run): адміністратор — усі; менеджер — ті, де він
// менеджер запуску або виконавець хоча б однієї задачі (design.md, D7).
export default async function RunsPage() {
  const { supabase } = await requireActor();
  const { data: runs } = await supabase
    .from("runs")
    .select("id, case_name, template_name, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Runs</h1>
        <Link href="/runs/new" className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background">
          Launch a template
        </Link>
      </div>
      {runs && runs.length > 0 ? (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {runs.map((run) => (
            <li key={run.id} data-testid="run-row">
              <Link href={`/runs/${run.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-medium">{run.case_name}</span>
                <span className="text-sm text-zinc-500">{run.template_name}</span>
                <span data-testid="run-status" className="text-sm">
                  {STATUS_LABEL[run.status] ?? run.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No runs yet.</p>
      )}
    </main>
  );
}
