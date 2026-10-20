import { MSG_CASE_NAME_TOO_LONG, MSG_EMPTY_CASE_NAME, MSG_NOT_ALLOWED_TO_MARK } from "@/lib/runs/rules";

// Коди помилок із ?error= → тексти на сторінці. Тексти AC — дослівно як у PM (AC-RUN-03, AC-RUN-07).
export const LAUNCH_ERRORS: Record<string, string> = {
  empty: MSG_EMPTY_CASE_NAME,
  too_long: MSG_CASE_NAME_TOO_LONG,
  forbidden: "Only a manager or an administrator can launch a template",
  failed: "The run could not be created. Try again.",
};

// Відмова в позначці задачі — дослівно AC-TASK-03.
export const RUN_ERRORS: Record<string, string> = {
  not_allowed: MSG_NOT_ALLOWED_TO_MARK,
};
