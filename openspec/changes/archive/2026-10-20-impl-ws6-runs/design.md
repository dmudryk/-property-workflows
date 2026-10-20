## Context

Шаблон проєкту дає вхід (Supabase Auth, email + пароль), `profiles` з ролями `member` / `admin` і хелпер
`private.current_app_role()`. Специфікація зрізу — `openspec/specs/workflow-runs/spec.md` (AC-RUN-01…09) і
`openspec/specs/run-tasks/spec.md` (AC-TASK-01…09). Відкриті питання до PM (solomchaak/property-workflows-spec#4–#18)
не блокують зріз: де відповіді ще немає, робимо найвужче прочитання тексту PM і фіксуємо його нижче.

## Goals / Non-Goals

**Goals:** запуск шаблону зі знімком задач; права на позначку «done» і завершення запуску; прогрес і видимість запусків —
так, щоб кожен AC перевіряв тест у `npm test`, а права дублювала RLS у базі.

**Non-Goals:** усе з Non-goals специфікації (умовна логіка, зміна виконавця після запуску, скасування запуску й позначки,
підрядники, дедлайни, дашборд); екран редагування шаблонів (шаблони — даними міграції); керування користувачами в
інтерфейсі (користувачі — `npm run users:demo`).

## Decisions

### D1. Ролі `manager` і `admin` (AC-RUN-05, AC-RUN-06, AC-TASK-07)

Нова міграція замінює набір ролей шаблону в порядку з `AGENTS.md`: зняти `profiles_role_check` → `member` → `manager`
→ default `manager` → новий `profiles_role_check` (`manager`, `admin`). Роль читаємо лише з `profiles.role` через
`private.current_app_role()`, ніколи з `user_metadata`. `supabase/demo-users.json`: `admin@example.test` і менеджери
`manager.a@`, `manager.b@`, `manager.c@example.test` — саме ті ролі, що в AC (менеджери A, B, C).

### D2. Модель даних і знімок шаблону (AC-RUN-01, AC-RUN-02)

- Шаблон: `templates` (назва) → `template_sections` (назва, позиція) → `template_tasks` (назва, `required`, позиція).
- Запуск: `runs` (шаблон, назва шаблону, `case_name`, `status` `in_progress` | `completed`, `manager_id`, час) і
  `run_tasks` (запуск, назва секції, назва задачі, `required`, позиція, `assignee_id`, `status` `to_do` | `done`,
  `done_at`, `done_by`).
- **Знімок:** під час запуску задачі шаблону **копіюються** в `run_tasks` (назва, секція, `required`). Пізніші зміни
  `template_tasks` наявних запусків не торкаються — AC-RUN-02. Позначку `required` теж копіюємо: це найближче до
  «run keeps the template exactly as it was at the moment of launch»; питання — solomchaak/property-workflows-spec#16.
- Демо-шаблон «Tenant move-in» (2 секції, 5 задач, 3 обов'язкові — як у AC) і «Repair» додаємо даними міграції
  (`insert … on conflict do nothing`), бо PM дозволяє готувати шаблони поза застосунком, а дані міграції гарантовано
  потрапляють у прод через `db-deploy` (сид — лише ручним запуском).

### D3. Правила — чисті функції в `src/lib/runs/` (усі AC)

Бізнес-правила зрізу — у `src/lib/runs/rules.ts` без залежності від бази: `validateCaseName`, `planRun`
(знімок задач і виконавці), `canMarkDone`, `markTaskDone`, `runStatus`, `progressLabel`, `visibleRuns`. Server actions викликають їх до
звернення до бази, сторінки — для прогресу. Тести `npm test` перевіряють саме їх, по одному `it("AC-…")` на AC. Ті самі
права й обмеження дублює база (RLS, `check`, функції), тож обійти їх запитом напряму не можна.

### D4. Назва випадку (AC-RUN-03, AC-RUN-07)

- Порожня чи з самих пробілів → «Enter a case name»; довша за 100 символів (рахуємо символи Unicode, а не UTF-16) →
  «Case name must be at most 100 characters»; запуск не створюється.
- Довжину рахуємо за введеним текстом, зберігаємо текст без пробілів по краях. Чи обрізати пробіли до перевірки
  довжини — питання solomchaak/property-workflows-spec#6; до відповіді — найвужче прочитання AC-RUN-07 («a case name of
  101 characters»).
- База: `check (char_length(btrim(case_name)) between 1 and 100)`.

### D5. Запуск — одна функція Postgres (AC-RUN-01, AC-RUN-04, AC-RUN-05, AC-RUN-06, AC-RUN-08, AC-RUN-09)

`public.launch_run(p_template_id, p_case_name, p_assignments jsonb) returns uuid`, `security invoker`: перевіряє роль і
назву, вставляє `runs` (`manager_id = auth.uid()`, `status = 'in_progress'`) і всі `run_tasks` шаблону (`status =
'to_do'`, `assignee_id` — з `p_assignments` за id задачі шаблону, інакше `auth.uid()`) **в одній транзакції** (у
supabase-js транзакцій немає). id запуску генеруємо до `insert`, без `returning`, щоб не залежати від політики `select`
на щойно вставлений рядок. Політики `insert`: `runs` — лише `manager_id = auth.uid()` і роль `manager`/`admin`;
`run_tasks` — лише в запуск, де `manager_id = auth.uid()`, і виконавець — `manager` чи `admin` (`private.is_staff`).
Змінити виконавця після запуску не можна: `update` на `assignee_id` не видано.

### D6. Позначка «done» і завершення (AC-TASK-01, AC-TASK-02, AC-TASK-03, AC-TASK-04, AC-TASK-07)

- `public.mark_task_done(p_task_id)`, `security invoker`: `update run_tasks set status = 'done', done_at, done_by` для
  задачі `to_do`. Політика `update`: виконавець, або менеджер запуску (`private.is_run_manager`), або `admin`;
  колонковий `grant update (status, done_at, done_by)`. Повторна позначка вже «done» задачі нічого не змінює (припущення
  PM). Якщо рядок не оновлено й задача не «done» для цього користувача — виняток `NOT_ALLOWED`, server action показує
  «Only the task's assignee, the run manager, or an administrator can mark a task as done».
- Тригер `after update of status on run_tasks` → `private.refresh_run_status(run_id)` (`security definer`, `set
  search_path = ''`): запуск `completed`, коли не лишилось обов'язкових задач `to_do` (AC-TASK-04). Необов'язкові задачі
  статусу запуску не змінюють. Скасування позначки немає — `done` → `to_do` не дозволено.
- `done_by`/`done_at` лише зберігаємо, на сторінці не показуємо: питання solomchaak/property-workflows-spec#17.

### D7. Видимість і прогрес (AC-TASK-05, AC-TASK-06, AC-TASK-08, AC-TASK-09)

- Політика `select` на `runs` і `run_tasks`: `private.can_see_run(run_id)` (`security definer`) — адміністратор; або
  менеджер запуску; або виконавець хоча б однієї задачі запуску (AC-TASK-06). Хелпер — у `private`, бо політика
  `run_tasks`, що читає `run_tasks`, інакше зациклюється (42P17).
- Прогрес «N of M done»: N — задачі `done`, M — усі задачі запуску (припущення PM) — на сторінці запуску (AC-TASK-05) і
  в кожному рядку списку `/runs` (AC-TASK-09). Список показує прогрес кожному, хто бачить запуск: це найвужче
  прочитання, яке не ховає даних, які виконавець і так бачить на сторінці запуску; питання —
  solomchaak/property-workflows-spec#18. Завершені запуски лишаються в списку зі статусом (питання #10).
- Сторінка запуску показує менеджеру запуску й виконавцям кожну задачу з секцією, виконавцем і статусом «done» /
  «to do» (AC-TASK-08) — RLS `run_tasks` пускає до всіх задач запуску, який користувач бачить.
- Імена виконавців: `profiles` менеджеру показує лише власний профіль (матриця прав), тому імена й email співробітників
  для вибору виконавця й сторінки запуску віддає `public.list_staff()` → `private.staff()` (`security definer`, лише id,
  ім'я, email ролей `manager`/`admin`); питання про обсяг цих даних — solomchaak/property-workflows-spec#5.

### D8. Сторінки й server actions

- `/` → перенаправлення на `/runs`.
- `/runs` — список видимих запусків: випадок, шаблон, статус, прогрес; посилання «Launch a template».
- `/runs/new` — вибір шаблону (`?template=`), назва випадку, виконавець для кожної задачі (за замовчуванням — «me»);
  server action `launchRun` → `validateCaseName` → `rpc('launch_run')` → `/runs/<id>`; помилка — `?error=`.
- `/runs/[id]` — прогрес, задачі за секціями, кнопка «Mark as done» на кожній задачі `to_do`; server action
  `markDone` → `rpc('mark_task_done')`; відмова — повідомлення AC-TASK-03.
- Мова інтерфейсу — англійська, як тексти статусів і повідомлень у PM (питання solomchaak/property-workflows-spec#13).
- Авторизація на сервері — `supabase.auth.getClaims()`, сесія — `src/proxy.ts`.

## Risks / Trade-offs

- Тести `npm test` перевіряють правила в `src/lib/runs/rules.ts`, а не базу: CI не має бази в job `app`. Права в базі
  перевіряє `db-check` (міграції на чистій базі) і ручна перевірка на прод-URL (запис екрана в останньому PR задачі).
- Відповіді PM на #6, #16, #17, #18 можуть змінити D2, D4, D6, D7 — тоді нова зміна специфікації з MODIFIED і задача.

## Migration Plan

Дві міграції, по одній на задачу: `…_runs_launch.sql` (задача 1: ролі, шаблони, запуски, `launch_run`, `list_staff`) і
`…_runs_complete_tasks.sql` (задача 2: `mark_task_done`, політика `update`, тригер завершення). Після merge задачі 1 —
`npm run users:demo` з оновленим `supabase/demo-users.json` (ролі `manager`).
