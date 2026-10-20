# Матриця відповідності (AC → код → тест → статус)

<!--
Ваша матриця: один рядок на кожен AC з openspec/specs/** — вашої специфікації, у яку ви перекладаєте вимоги PM
(їхній знімок у requirements/ приносить команда агента /requirements-sync).
Рядок «Вимоги» під цим коментарем заповнює лише /requirements-sync: адреса репо вимог PM, звідки взято вимоги (issues
або файли docs/), і дата знімка, через « · ». Руками його не змінюйте: з нього /requirements-sync знає, звідки брати
вимоги наступного разу, а скіли spec-clarify, spec-review і /conformance — куди ставити питання й яку версію вимог ви
реалізуєте. Рядків таблиці /requirements-sync не додає.
Рядки змінюєте ви:
  PR «Специфікація» — після archive зміни: рядок кожного нового AC зі статусом «відкладено (чекає реалізації)»; рядки AC,
                      прибраних зі специфікації (REMOVED), — видалити;
  PR «Реалізація»   — рядок AC задачі в тому самому PR, що й код і тест.
Перебудувати автоматично: /conformance (Claude Code, Cursor).
Перевірка в CI: npm run ac:coverage — падає, якщо
  NO-ROW     AC є в специфікації, а рядка немає (типово — PR «Специфікація» без нових рядків або рядок видалено);
  MISSING    статус «реалізовано», а непропущеного тесту, назва якого починається з цього AC ID, у файлах
             *.test.ts / *.test.tsx немає (*.spec.ts і допоміжні файли Vitest не запускає — вони не рахуються);
  ORPHAN     тест посилається на AC, якого немає в специфікації (AC прибрано або вимогу PM ще не перекладено);
  BAD-STATUS статус не «реалізовано» і не «відкладено (причина)»;
  WRONG-REF  шляху `src/…`/`tests/…`/`supabase/…` з колонок «Код»/«Тест» немає або тест із цим AC в іншому файлі;
і попереджає, не падаючи: AC з вимог PM (requirements/), якого ще немає в openspec/specs/, — «вимогу PM ще не перекладено
в специфікацію».

Приклад рядків (усередині коментаря — скрипт їх не читає):
| AC-LEAVE-02 | заявка на дві посади дає два записи main і additional | `src/app/requests/actions.ts` (createRequest) | `tests/requests.test.ts` | реалізовано |
| AC-LEAVE-04 | заблоковані дні не рахуються | — | — | відкладено (чекаю відповідь PM на Q2, <pm>/<team-slug>-spec#5) |
| AC-LEAVE-07 | менеджер бачить лише свій відділ | — | — | відкладено (рішення PM: поза зрізом 1, <pm>/<team-slug>-spec#8) |
| AC-LEAVE-10 | діапазон лише із заблокованих днів | — | — | відкладено (чекає реалізації) |
-->

Вимоги: https://github.com/solomchaak/property-workflows-spec · джерело: issues · знімок 2026-10-20

| AC | Що перевіряє | Код | Тест | Статус |
|---|---|---|---|---|
| AC-TASK-01 | виконавець позначає свою задачу виконаною — статус «done» | `src/lib/runs/rules.ts` (markTaskDone), `supabase/migrations/20261020124103_runs_complete_tasks.sql` (mark_task_done) | `src/lib/runs/tasks.test.ts` | реалізовано |
| AC-TASK-02 | менеджер запуску позначає чужу задачу свого запуску — статус «done» | `src/lib/runs/rules.ts` (markTaskDone), `supabase/migrations/20261020124103_runs_complete_tasks.sql` (mark_task_done) | `src/lib/runs/tasks.test.ts` | реалізовано |
| AC-TASK-07 | адміністратор позначає задачу чужого запуску — статус «done» | `src/lib/runs/rules.ts` (markTaskDone), `supabase/migrations/20261020124103_runs_complete_tasks.sql` (mark_task_done) | `src/lib/runs/tasks.test.ts` | реалізовано |
| AC-TASK-03 | сторонній менеджер не може позначити задачу: лишається «to do» і повідомлення | `src/lib/runs/rules.ts` (markTaskDone), `supabase/migrations/20261020124103_runs_complete_tasks.sql` (mark_task_done) | `src/lib/runs/tasks.test.ts` | реалізовано |
| AC-TASK-04 | остання обов'язкова задача «done» переводить запуск у «completed» | `src/lib/runs/rules.ts` (markTaskDone), `supabase/migrations/20261020124103_runs_complete_tasks.sql` (mark_task_done) | `src/lib/runs/tasks.test.ts` | реалізовано |
| AC-TASK-05 | сторінка запуску показує прогрес «2 of 5 done» | `src/lib/runs/rules.ts` (progressLabel), `src/app/runs/[id]/page.tsx` | `src/lib/runs/tasks.test.ts` | реалізовано |
| AC-TASK-08 | сторінка запуску показує статус кожної з 5 задач | `src/lib/runs/rules.ts` (taskStatusLabel), `src/app/runs/[id]/page.tsx` | `src/lib/runs/tasks.test.ts` | реалізовано |
| AC-TASK-09 | список запусків менеджера показує прогрес «2 of 5 done» | `src/lib/runs/rules.ts` (progressLabel), `src/app/runs/page.tsx` | `src/lib/runs/tasks.test.ts` | реалізовано |
| AC-TASK-06 | менеджер бачить лише свої запуски й запуски, де він виконавець | `src/lib/runs/rules.ts` (visibleRuns), `supabase/migrations/20261020123813_runs_launch.sql` (can_see_run) | `src/lib/runs/tasks.test.ts` | реалізовано |
| AC-RUN-01 | запуск шаблону створює один запуск «in progress» з усіма 5 задачами «to do» | `src/lib/runs/rules.ts` (planRun), `supabase/migrations/20261020123813_runs_launch.sql` (launch_run) | `src/lib/runs/launch.test.ts` | реалізовано |
| AC-RUN-02 | зміна шаблону після запуску не змінює задачі й назви в запуску | `src/lib/runs/rules.ts` (planRun), `supabase/migrations/20261020123813_runs_launch.sql` (launch_run) | `src/lib/runs/launch.test.ts` | реалізовано |
| AC-RUN-03 | порожня назва чи назва з пробілів — запуску немає, «Enter a case name» | `src/lib/runs/rules.ts` (planRun), `supabase/migrations/20261020123813_runs_launch.sql` (launch_run) | `src/lib/runs/launch.test.ts` | реалізовано |
| AC-RUN-07 | назва з 101 символу — запуску немає, «Case name must be at most 100 characters» | `src/lib/runs/rules.ts` (planRun), `supabase/migrations/20261020123813_runs_launch.sql` (launch_run) | `src/lib/runs/launch.test.ts` | реалізовано |
| AC-RUN-05 | адміністратор запускає шаблон і стає менеджером запуску | `src/lib/runs/rules.ts` (planRun), `supabase/migrations/20261020123813_runs_launch.sql` (launch_run) | `src/lib/runs/launch.test.ts` | реалізовано |
| AC-RUN-06 | менеджер запускає шаблон і стає менеджером запуску | `src/lib/runs/rules.ts` (planRun), `supabase/migrations/20261020123813_runs_launch.sql` (launch_run) | `src/lib/runs/launch.test.ts` | реалізовано |
| AC-RUN-04 | дві задачі призначено менеджеру B, решта три — менеджеру A | `src/lib/runs/rules.ts` (planRun), `supabase/migrations/20261020123813_runs_launch.sql` (launch_run) | `src/lib/runs/launch.test.ts` | реалізовано |
| AC-RUN-08 | менеджер без призначень — виконавець усіх 5 задач | `src/lib/runs/rules.ts` (planRun), `supabase/migrations/20261020123813_runs_launch.sql` (launch_run) | `src/lib/runs/launch.test.ts` | реалізовано |
| AC-RUN-09 | адміністратор без призначень — виконавець усіх 5 задач | `src/lib/runs/rules.ts` (planRun), `supabase/migrations/20261020123813_runs_launch.sql` (launch_run) | `src/lib/runs/launch.test.ts` | реалізовано |
