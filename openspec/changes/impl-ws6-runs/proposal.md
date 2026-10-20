## Why

Реалізуємо зріз WS6 — специфікацію, злиту зміною `add-ws6-runs` (`openspec/specs/workflow-runs/spec.md`,
`openspec/specs/run-tasks/spec.md`): менеджер чи адміністратор запускає шаблон для випадку, виконавці позначають задачі
виконаними, прогрес видно на сторінці запуску й у списку запусків.

## What Changes

Зміна покриває всі 18 AC специфікації зрізу двома вертикальними задачами (див. `tasks.md`):

- запуск шаблону для випадку (`workflow-runs`): AC-RUN-01, AC-RUN-02, AC-RUN-03, AC-RUN-04, AC-RUN-05, AC-RUN-06,
  AC-RUN-07, AC-RUN-08, AC-RUN-09;
- позначка задач, завершення запуску, прогрес і видимість (`run-tasks`): AC-TASK-01, AC-TASK-02, AC-TASK-03,
  AC-TASK-04, AC-TASK-05, AC-TASK-06, AC-TASK-07, AC-TASK-08, AC-TASK-09.
