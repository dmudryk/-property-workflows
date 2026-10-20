-- Зріз WS6, задача 2: позначка задачі «done» і завершення запуску.
-- Специфікація: openspec/specs/run-tasks (AC-TASK-01…04, AC-TASK-07); план: openspec/changes/impl-ws6-runs/design.md (D6),
-- docs/decisions/0001-writes-via-private-functions.md — запис лише через функції private (security definer).
-- Правила міграцій — AGENTS.md → «База даних». Прямого update на run_tasks для authenticated немає.

-- ── Завершення запуску (AC-TASK-04): completed, коли не лишилось обов'язкових задач to_do ──
-- Необов'язкові задачі статусу запуску не змінюють. Тригерна функція — лише для тригера, викликати її не можна.
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

-- ── Позначка «done» (D6 + ADR 0001) ──
-- security definer: RLS тут не діє, тому права перевіряємо явно — виконавець задачі, менеджер її запуску або адміністратор
-- (AC-TASK-01, AC-TASK-02, AC-TASK-07); інакше NOT_ALLOWED (AC-TASK-03). Лише to_do → done; повторна позначка вже
-- «done» задачі нічого не змінює (припущення PM).
create or replace function private.mark_task_done(p_task_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_task record;
begin
  select t.id, t.status, t.assignee_id, r.manager_id
  into v_task
  from public.run_tasks as t
  join public.runs as r on r.id = t.run_id
  where t.id = p_task_id;

  if v_uid is null
    or v_task.id is null
    or not (
      v_task.assignee_id = v_uid
      or v_task.manager_id = v_uid
      or (select private.current_app_role()) = 'admin'
    )
  then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  if v_task.status = 'done' then
    return;
  end if;

  update public.run_tasks
  set status = 'done', done_at = now(), done_by = v_uid
  where id = p_task_id and status = 'to_do';
end;
$$;

revoke execute on function private.mark_task_done(uuid) from public, anon;
grant execute on function private.mark_task_done(uuid) to authenticated;

-- Обгортка для Data API (схема private не відкрита).
create or replace function public.mark_task_done(p_task_id uuid)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.mark_task_done(p_task_id);
$$;

revoke execute on function public.mark_task_done(uuid) from public, anon;
grant execute on function public.mark_task_done(uuid) to authenticated;
