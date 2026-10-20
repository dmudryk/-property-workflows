-- Зріз WS6, задача 1: ролі manager/admin, шаблони, запуски й запуск шаблону для випадку.
-- Специфікація: openspec/specs/workflow-runs (AC-RUN-01…09); план: openspec/changes/impl-ws6-runs/design.md (D1, D2, D4, D5, D7).
-- Правила міграцій — AGENTS.md → «База даних»: RLS на кожній таблиці, revoke + явні grant, політика на кожну операцію
-- to authenticated з (select auth.uid()), security definer — лише в private з set search_path = ''.

-- ── D1. Ролі: member → manager (порядок — як у заголовку 20261012000000_profiles_and_roles.sql) ──
alter table public.profiles drop constraint profiles_role_check;
update public.profiles set role = 'manager' where role = 'member';
alter table public.profiles alter column role set default 'manager';
alter table public.profiles add constraint profiles_role_check check (role in ('manager', 'admin'));

-- ── D2. Шаблони (готує адміністратор поза застосунком; тут — лише читання) ──
create table public.templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.template_sections (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  name        text not null,
  position    integer not null
);

create table public.template_tasks (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  section_id  uuid not null references public.template_sections (id) on delete cascade,
  name        text not null,
  required    boolean not null,
  position    integer not null
);

create index template_sections_template_idx on public.template_sections (template_id);
create index template_tasks_template_idx on public.template_tasks (template_id);
create index template_tasks_section_idx on public.template_tasks (section_id);

comment on table public.templates is 'Шаблон процесу: секції із задачами. Готує адміністратор (у зрізі WS6 — даними міграції).';

alter table public.templates enable row level security;
alter table public.template_sections enable row level security;
alter table public.template_tasks enable row level security;

revoke all on table public.templates, public.template_sections, public.template_tasks from anon, authenticated;
grant select on table public.templates, public.template_sections, public.template_tasks to authenticated;
grant select, insert, update, delete on table public.templates, public.template_sections, public.template_tasks to service_role;

-- Шаблони бачать усі ролі зрізу (матриця прав: See templates — manager, admin).
create policy templates_select_staff on public.templates
  for select to authenticated
  using ((select private.current_app_role()) in ('manager', 'admin'));
create policy template_sections_select_staff on public.template_sections
  for select to authenticated
  using ((select private.current_app_role()) in ('manager', 'admin'));
create policy template_tasks_select_staff on public.template_tasks
  for select to authenticated
  using ((select private.current_app_role()) in ('manager', 'admin'));

-- ── D2. Запуски: знімок задач шаблону на момент запуску (AC-RUN-02) ──
create table public.runs (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.templates (id),
  template_name text not null,
  case_name     text not null,
  status        text not null default 'in_progress',
  manager_id    uuid not null references public.profiles (id),
  created_at    timestamptz not null default now(),
  -- D4: 1–100 символів, не лише пробіли (AC-RUN-03, AC-RUN-07).
  constraint runs_case_name_check check (char_length(btrim(case_name)) between 1 and 100),
  constraint runs_status_check check (status in ('in_progress', 'completed'))
);

create table public.run_tasks (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.runs (id) on delete cascade,
  section_name text not null,
  name         text not null,
  required     boolean not null,
  position     integer not null,
  assignee_id  uuid not null references public.profiles (id),
  status       text not null default 'to_do',
  done_at      timestamptz,
  done_by      uuid references public.profiles (id),
  constraint run_tasks_status_check check (status in ('to_do', 'done'))
);

create index runs_manager_idx on public.runs (manager_id);
create index run_tasks_run_idx on public.run_tasks (run_id);
create index run_tasks_assignee_idx on public.run_tasks (assignee_id);

comment on table public.runs is 'Запуск шаблону для випадку. Менеджер запуску — той, хто запустив (AC-RUN-05, AC-RUN-06).';
comment on table public.run_tasks is 'Копія задач шаблону на момент запуску; виконавця задають лише під час запуску.';

alter table public.runs enable row level security;
alter table public.run_tasks enable row level security;

revoke all on table public.runs, public.run_tasks from anon, authenticated;
-- Читання — під політиками нижче; вставка — лише через public.launch_run (і її політики).
-- update/delete для authenticated тут не видаємо: зміну статусу задачі додає наступна міграція (задача 2).
grant select, insert on table public.runs, public.run_tasks to authenticated;
grant select, insert, update, delete on table public.runs, public.run_tasks to service_role;

-- ── Хелпери (security definer, лише private) ──
-- Чи бачить поточний користувач запуск: адміністратор, менеджер запуску або виконавець хоча б однієї задачі (AC-TASK-06).
-- security definer читає runs і run_tasks в обхід RLS, тож політики не зациклюються (42P17).
create or replace function private.can_see_run(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.runs as r
    where r.id = p_run_id
      and (
        (select private.current_app_role()) = 'admin'
        or r.manager_id = (select auth.uid())
        or exists (
          select 1 from public.run_tasks as t
          where t.run_id = r.id and t.assignee_id = (select auth.uid())
        )
      )
  );
$$;

-- Чи є користувач співробітником зрізу (менеджер чи адміністратор): лише вони можуть бути виконавцями.
create or replace function private.is_staff(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles as p
    where p.id = p_user_id and p.role in ('manager', 'admin')
  );
$$;

-- Співробітники для вибору виконавця й імен на сторінці запуску: лише id, ім'я, email (profiles менеджеру показує
-- лише власний профіль — матриця прав).
create or replace function private.staff()
returns table (id uuid, full_name text, email text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.email, p.role
  from public.profiles as p
  where p.role in ('manager', 'admin')
    and (select private.current_app_role()) in ('manager', 'admin')
  order by p.full_name nulls last, p.email;
$$;

revoke execute on function private.can_see_run(uuid), private.is_staff(uuid), private.staff() from public, anon;
grant execute on function private.can_see_run(uuid), private.is_staff(uuid), private.staff() to authenticated;

-- ── Політики RLS ──
create policy runs_select_visible on public.runs
  for select to authenticated
  using ((select private.can_see_run(id)));

create policy runs_insert_own on public.runs
  for insert to authenticated
  with check (
    manager_id = (select auth.uid())
    and status = 'in_progress'
    and (select private.current_app_role()) in ('manager', 'admin')
  );

create policy run_tasks_select_visible on public.run_tasks
  for select to authenticated
  using ((select private.can_see_run(run_id)));

-- Задачі — лише в запуск, де поточний користувач менеджер запуску; виконавець — менеджер чи адміністратор (AC-RUN-04).
create policy run_tasks_insert_by_run_manager on public.run_tasks
  for insert to authenticated
  with check (
    status = 'to_do'
    and done_at is null
    and done_by is null
    and (select private.is_staff(assignee_id))
    and exists (
      select 1 from public.runs as r
      where r.id = run_id and r.manager_id = (select auth.uid())
    )
  );

-- ── D5. Запуск шаблону — одна транзакція ──
-- p_assignments: {"<id задачі шаблону>": "<id виконавця>", …}; задачі без призначення — менеджеру запуску
-- (AC-RUN-04, AC-RUN-08, AC-RUN-09). id запуску генеруємо заздалегідь: без returning і без select щойно вставленого рядка.
create or replace function public.launch_run(
  p_template_id uuid,
  p_case_name text,
  p_assignments jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run_id uuid := gen_random_uuid();
  v_uid uuid := (select auth.uid());
  v_template_name text;
begin
  if v_uid is null or (select private.current_app_role()) not in ('manager', 'admin') then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_case_name, ''))) = 0 then
    raise exception 'EMPTY_CASE_NAME' using errcode = '22023';
  end if;
  if char_length(coalesce(p_case_name, '')) > 100 then
    raise exception 'CASE_NAME_TOO_LONG' using errcode = '22023';
  end if;

  select t.name into v_template_name from public.templates as t where t.id = p_template_id;
  if v_template_name is null then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.runs (id, template_id, template_name, case_name, status, manager_id)
  values (v_run_id, p_template_id, v_template_name, btrim(p_case_name), 'in_progress', v_uid);

  insert into public.run_tasks (run_id, section_name, name, required, position, assignee_id, status)
  select
    v_run_id,
    s.name,
    tt.name,
    tt.required,
    s.position * 1000 + tt.position,
    coalesce(nullif(coalesce(p_assignments, '{}'::jsonb) ->> tt.id::text, '')::uuid, v_uid),
    'to_do'
  from public.template_tasks as tt
  join public.template_sections as s on s.id = tt.section_id
  where tt.template_id = p_template_id;

  return v_run_id;
end;
$$;

revoke execute on function public.launch_run(uuid, text, jsonb) from public, anon;
grant execute on function public.launch_run(uuid, text, jsonb) to authenticated;

-- Обгортка для Data API (схема private не відкрита): список співробітників.
create or replace function public.list_staff()
returns table (id uuid, full_name text, email text, role text)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.full_name, s.email, s.role from private.staff() as s;
$$;

revoke execute on function public.list_staff() from public, anon;
grant execute on function public.list_staff() to authenticated;

-- ── D2. Демо-шаблони (синтетичні дані; ідемпотентно) ──
insert into public.templates (id, name) values
  ('a1000000-0000-4000-8000-000000000001', 'Tenant move-in'),
  ('a1000000-0000-4000-8000-000000000002', 'Repair')
on conflict (id) do nothing;

insert into public.template_sections (id, template_id, name, position) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Before move-in', 1),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Move-in day', 2),
  ('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002', 'Assessment', 1),
  ('b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000002', 'Works', 2)
on conflict (id) do nothing;

-- «Tenant move-in»: 2 секції, 5 задач, 3 обов'язкові — як у AC-RUN-01.
insert into public.template_tasks (id, template_id, section_id, name, required, position) values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Sign the lease', true, 1),
  ('c1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Collect the deposit', true, 2),
  ('c1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Order cleaning', false, 3),
  ('c1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Hand over the keys', true, 1),
  ('c1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'Read the meters', false, 2),
  ('c1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000003', 'Inspect the damage', true, 1),
  ('c1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'Fix the issue', true, 1),
  ('c1000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'Take photos', false, 2)
on conflict (id) do nothing;
