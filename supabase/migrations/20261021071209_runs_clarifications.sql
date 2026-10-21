-- Зріз WS6, уточнення PM від 2026-10-20 (openspec/changes/archive/2026-10-21-update-ws6-clarifications):
--   AC-RUN-11 — пробіли на початку й у кінці назви випадку обрізаються ДО перевірки довжини;
--   AC-RUN-10, AC-TASK-11 — менеджер бачить про інших співробітників лише email (без імен і ролей).
-- Правила міграцій — AGENTS.md → «База даних»; запис — лише через функції private (ADR 0001).

-- ── AC-RUN-11: довжину перевіряємо після обрізання пробілів ──
-- Сигнатура та сама, тож create or replace зберігає гранти; тіло — як у 20261020123813_runs_launch.sql, крім перевірки.
create or replace function private.launch_run(
  p_template_id uuid,
  p_case_name text,
  p_assignments jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_run_id uuid := gen_random_uuid();
  v_uid uuid := (select auth.uid());
  v_template_name text;
  v_case_name text := btrim(coalesce(p_case_name, ''));
  v_assignments jsonb := coalesce(p_assignments, '{}'::jsonb);
begin
  if v_uid is null or (select private.current_app_role()) not in ('manager', 'admin') then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if char_length(v_case_name) = 0 then
    raise exception 'EMPTY_CASE_NAME' using errcode = '22023';
  end if;
  if char_length(v_case_name) > 100 then
    raise exception 'CASE_NAME_TOO_LONG' using errcode = '22023';
  end if;

  if jsonb_typeof(v_assignments) <> 'object' then
    raise exception 'INVALID_ASSIGNMENTS' using errcode = '22023';
  end if;

  select t.name into v_template_name from public.templates as t where t.id = p_template_id;
  if v_template_name is null then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Кожен призначений виконавець задачі цього шаблону — менеджер чи адміністратор (AC-RUN-04).
  if exists (
    select 1
    from public.template_tasks as tt
    where tt.template_id = p_template_id
      and nullif(v_assignments ->> tt.id::text, '') is not null
      and not private.is_staff(nullif(v_assignments ->> tt.id::text, '')::uuid)
  ) then
    raise exception 'INVALID_ASSIGNEE' using errcode = '22023';
  end if;

  insert into public.runs (id, template_id, template_name, case_name, status, manager_id)
  values (v_run_id, p_template_id, v_template_name, v_case_name, 'in_progress', v_uid);

  -- Секції, їхні назви й порядок, позначки required — копія на момент запуску (AC-RUN-02, AC-RUN-12).
  insert into public.run_tasks (run_id, section_name, name, required, position, assignee_id, status)
  select
    v_run_id,
    s.name,
    tt.name,
    tt.required,
    s.position * 1000 + tt.position,
    coalesce(nullif(v_assignments ->> tt.id::text, '')::uuid, v_uid),
    'to_do'
  from public.template_tasks as tt
  join public.template_sections as s on s.id = tt.section_id
  where tt.template_id = p_template_id;

  return v_run_id;
end;
$$;

-- ── AC-RUN-10, AC-TASK-11: про співробітників — лише id і email ──
-- Зміна набору колонок результату потребує drop + create; обгортку public.list_staff знімаємо першою.
drop function public.list_staff();
drop function private.staff();

create function private.staff()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email
  from public.profiles as p
  where p.role in ('manager', 'admin')
    and (select private.current_app_role()) in ('manager', 'admin')
  order by p.email;
$$;

revoke execute on function private.staff() from public, anon;
grant execute on function private.staff() to authenticated;

create function public.list_staff()
returns table (id uuid, email text)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.email from private.staff() as s;
$$;

revoke execute on function public.list_staff() from public, anon;
grant execute on function public.list_staff() to authenticated;
