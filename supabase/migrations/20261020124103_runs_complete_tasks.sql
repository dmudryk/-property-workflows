-- Зріз WS6, задача 2: позначка задачі «done» і завершення запуску.
-- Специфікація: openspec/specs/run-tasks (AC-TASK-01…04, AC-TASK-07); план: openspec/changes/impl-ws6-runs/design.md (D6).
-- Правила міграцій — AGENTS.md → «База даних».

-- ── Хелпер: чи поточний користувач — менеджер запуску (security definer, лише private) ──
create or replace function private.is_run_manager(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.runs as r
    where r.id = p_run_id and r.manager_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_run_manager(uuid) from public, anon;
grant execute on function private.is_run_manager(uuid) to authenticated;

-- ── Права: лише статус і хто/коли позначив; виконавця після запуску не змінюють ──
grant update (status, done_at, done_by) on table public.run_tasks to authenticated;

-- Позначити задачу може її виконавець, менеджер запуску або адміністратор (AC-TASK-01, AC-TASK-02, AC-TASK-07).
-- Лише to_do → done: скасування позначки в зрізі немає.
create policy run_tasks_update_mark_done on public.run_tasks
  for update to authenticated
  using (
    status = 'to_do'
    and (
      assignee_id = (select auth.uid())
      or (select private.is_run_manager(run_id))
      or (select private.current_app_role()) = 'admin'
    )
  )
  with check (
    status = 'done'
    and done_by = (select auth.uid())
  );

-- ── Завершення запуску (AC-TASK-04): completed, коли не лишилось обов'язкових задач to_do ──
-- security definer: виконавець не має права оновлювати runs, а статус запуску змінюється лише через задачі.
create or replace function private.refresh_run_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.runs as r
  set status = case
    when exists (
      select 1 from public.run_tasks as t
      where t.run_id = r.id and t.required and t.status = 'to_do'
    ) then 'in_progress'
    else 'completed'
  end
  where r.id = new.run_id;
  return null;
end;
$$;

revoke execute on function private.refresh_run_status() from public, anon, authenticated;

create trigger run_tasks_refresh_run_status
  after update of status on public.run_tasks
  for each row execute function private.refresh_run_status();

-- ── Позначка «done» (D6): повторна позначка вже «done» задачі нічого не змінює (припущення PM) ──
create or replace function public.mark_task_done(p_task_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_updated integer;
begin
  if v_uid is null then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  update public.run_tasks
  set status = 'done', done_at = now(), done_by = v_uid
  where id = p_task_id and status = 'to_do';
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    -- Задача вже «done» і користувач її бачить — нічого не змінюємо; інакше (немає прав або задачі не видно) — відмова.
    if exists (select 1 from public.run_tasks where id = p_task_id and status = 'done') then
      return;
    end if;
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.mark_task_done(uuid) from public, anon;
grant execute on function public.mark_task_done(uuid) to authenticated;
