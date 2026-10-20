import Link from "next/link";
import { signOut } from "../login/actions";
import { requireActor } from "./actor";

export default async function RunsLayout({ children }: LayoutProps<"/runs">) {
  const { actor, email } = await requireActor();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <Link href="/runs" className="text-lg font-semibold">
          Runs
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span data-testid="user-email">{email ?? "—"}</span>
          <span data-testid="user-role" className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
            {actor?.role ?? "no role"}
          </span>
          <form action={signOut}>
            <button type="submit" className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
