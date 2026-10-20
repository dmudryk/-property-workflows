## 1. Запуск шаблону для випадку (PR «Реалізація» `task/launch-run`)

- [ ] 1.1 Міграція `…_runs_launch.sql`: ролі `manager`/`admin` (D1); `templates`, `template_sections`,
      `template_tasks`, `runs`, `run_tasks` з RLS, `revoke` + явними `grant`, політиками `select`/`insert`; хелпери
      `private.can_see_run`, `private.is_staff`, `private.staff`; функції `public.launch_run`, `public.list_staff`;
      демо-шаблони «Tenant move-in» і «Repair» (D2, D5, D7)
- [ ] 1.2 `supabase/demo-users.json`: `admin@`, `manager.a@`, `manager.b@`, `manager.c@example.test` (D1);
      `src/lib/supabase/database.types.ts` — нові таблиці й функції
- [ ] 1.3 `src/lib/runs/rules.ts`: `validateCaseName`, `planRun`; тести `src/lib/runs/launch.test.ts` (D3, D4)
- [ ] 1.4 Сторінки `/runs` (список, поки без прогресу), `/runs/new` (форма запуску), `/runs/[id]` (задачі й виконавці);
      server action `launchRun`; `/` → `/runs` (D8)
- [ ] 1.5 Рядки `docs/conformance.md` для AC-RUN-01…09 — «реалізовано»

Done when: AC-RUN-01, AC-RUN-02, AC-RUN-03, AC-RUN-04, AC-RUN-05, AC-RUN-06, AC-RUN-07, AC-RUN-08, AC-RUN-09

## 2. Позначка задач, завершення запуску, прогрес і видимість (PR «Реалізація» `task/complete-tasks`)

- [ ] 2.1 Міграція `…_runs_complete_tasks.sql`: політика `update` на `run_tasks` (виконавець / менеджер запуску /
      `admin`), колонковий `grant update (status, done_at, done_by)`, `public.mark_task_done`, тригер
      `private.refresh_run_status` (D6)
- [ ] 2.2 `src/lib/runs/rules.ts`: `canMarkDone`, `markTaskDone`, `runStatus`, `progressLabel`, `visibleRuns`; тести
      `src/lib/runs/tasks.test.ts` (D3, D6, D7)
- [ ] 2.3 `/runs/[id]`: прогрес «N of M done», статус кожної задачі, кнопка «Mark as done», повідомлення відмови;
      `/runs`: прогрес у кожному рядку; server action `markDone` (D7, D8)
- [ ] 2.4 Рядки `docs/conformance.md` для AC-TASK-01…09 — «реалізовано»; запис екрана з прод-URL в описі PR;
      archive `impl-ws6-runs`

Done when: AC-TASK-01, AC-TASK-02, AC-TASK-03, AC-TASK-04, AC-TASK-05, AC-TASK-06, AC-TASK-07, AC-TASK-08, AC-TASK-09
