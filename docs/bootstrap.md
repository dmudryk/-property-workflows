# Чекліст розробника, день 0

<!--
Заповнюєте ви одразу після заняття, у цьому порядку: власне репо, власні Supabase і Vercel, перший зелений CI, ruleset.
Мета — застосунок працює локально й на вашому прод-URL, міграції в базу застосовує лише CI, а в main усе йде через PR.
Для кожного пункту — доказ: посилання (run CI, PR, preview), назва змінної або знімок екрана в docs/img/
(без справжніх назв клієнта й людей: зображення spec:check не перевіряє).
ЗНАЧЕННЯ СЕКРЕТІВ І ПАРОЛІВ НІКОЛИ НЕ ПИШІТЬ — лише назви змінних і де вони задані.
Заповнений файл (розділи 1–6) — ваш перший PR, тип «Реалізація» (розділ 7): він же перевіряє ruleset. Посилання на сам
цей PR і на preview допишіть наступним PR. Пояснення кроків — README, «Шлях розробника».
Docker не потрібен: локально — лише npm run dev проти вашої бази; міграції на одноразовій базі перевіряє CI (db-check).
-->

Моє репо: https://github.com/dmudryk/-property-workflows · Прод-URL: https://property-workflows-bravo16.vercel.app
Репо вимог PM: https://github.com/solomchaak/property-workflows-spec · Організація Supabase: `property-workflows` (Free)

## 1. Інструменти й репо

- [x] Node 24 (`node -v` → v24.14.1), Git, GitHub CLI (`gh` 2.95.0, `gh auth status` — увійдено); OpenSpec CLI глобально
      тієї ж версії, що в `package.json`: `npm i -g @fission-ai/openspec@1.14.1` → `openspec --version` = `1.14.1`
- [x] Репо створено з шаблону (**Use this template → Create a new repository**): власник — особистий акаунт `dmudryk`,
      **Public**, шаблон — `koldovsky/2026-quitcode-06-project-template` — https://github.com/dmudryk/-property-workflows
      (назва з дефісом на початку: `-property-workflows`)
- [x] `git clone` → `npm ci` → `.env.local` з `.env.example` (`Copy-Item .env.example .env.local`)
- [x] CodeRabbit (GitHub App) встановлено на це репо — рев'ю в PR: https://github.com/dmudryk/-property-workflows/pull/2
- [ ] (Якщо PM надіслав список справжніх назв клієнта особистим повідомленням) — локальний `product/denylist.local.txt`
      — PM списку не надсилав

## 2. Supabase: власна база

- [x] Організацію `property-workflows` і проєкт `property-workflows` створено у власному акаунті (Free)
- [x] Authentication → Sign In / Providers: «Allow new users to sign up» **вимкнено**, «Confirm email» **вимкнено** —
      перевірено через `GET /auth/v1/settings` (2026-10-20): `disable_signup: true`, `mailer_autoconfirm: true`
- [x] Authentication → URL Configuration: Site URL = `https://property-workflows-bravo16.vercel.app`; Redirect URLs
      `http://localhost:3000/**`, `https://property-workflows-*-bravo16.vercel.app/**`
- [x] `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
      `DEMO_USER_PASSWORD` — задані лише локально (файл у `.gitignore`); значень тут немає

## 3. GitHub: environment `production` і секрети

- [x] Settings → Environments → `production`: **Deployment branches** = Selected branches → `main`
      (`GET /repos/dmudryk/-property-workflows/environments/production/deployment-branch-policies` → `main`)
- [x] Секрет environment `SUPABASE_DB_URL` — рядок **Session pooler** (порт 5432) з Supabase → Connect; секретів
      репозиторію немає
- [x] Запасний шлях — не потрібно (`--db-url` працює)
- [ ] (Необов'язково) секрет репо `SPEC_DENYLIST` — не задано (PM списку не надсилав)

## 4. Vercel

- [x] Add New → Project → імпорт `dmudryk/-property-workflows` — https://property-workflows-bravo16.vercel.app
- [x] Змінні Production і Preview — лише `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
      `SUPABASE_SECRET_KEY` у Vercel немає; Marketplace-інтеграцію Supabase прибрано (Integrations → порожньо)
- [x] Settings → Deployment Protection → **Require Log In** вимкнено: прод-URL без входу у Vercel відкриває `/login`
      застосунку (HTTP 307 → `/login`, 200)
- [x] Прод-деплой з `main` пройшов — https://property-workflows-bravo16.vercel.app

## 5. База й перший зелений CI

- [x] Actions → CI → **Run workflow** (гілка `main`, `include_seed` ✓) → `db-deploy` застосував першу міграцію й сид —
      https://github.com/dmudryk/-property-workflows/actions/runs/39425600941
      («Applying migration 20261012000000_profiles_and_roles.sql… Seeding data from supabase/seed.sql…»)
- [ ] `npm run users:demo` → вхід як `admin@example.test` локально й на прод-URL — після міграції ролей задачі 1
      (`manager`/`admin`, PR «Реалізація» задачі 1)
- [x] CI на `main` зелений: `spec`, `app`, `conformance`, `db-check`, `db-deploy` —
      https://github.com/dmudryk/-property-workflows/actions/runs/39425600941

## 6. Ruleset `solo-main` (лише після зеленого CI на `main`)

- [x] Ruleset `solo-main` імпортовано з `materials/rulesets/solo-main.json` курсового репо (`gh api … /rulesets`):
      гілка за замовчуванням; deletion, non_fast_forward; pull request — 0 approvals, Squash і Merge; обов'язкові
      `spec`, `app`, `conformance`, `db-check`; bypass — порожній; enforcement — active

## 7. Перший PR (перевірка ruleset-у)

- [x] Перший PR — «Оновлення вимог» https://github.com/dmudryk/-property-workflows/pull/1 (CI зелений,
      `@coderabbitai review`); цей файл — PR `setup/bootstrap`
- [x] Поки перевірки не зелені, merge заблоковано ruleset-ом `solo-main` (обов'язкові `spec`, `app`, `conformance`,
      `db-check`); у `main` — лише PR
- [x] Vercel створює preview для PR — https://property-workflows-git-spec-add-ws6-runs-bravo16.vercel.app (PR #2)
- [x] **Squash and merge** → прод-деплой Vercel пройшов — https://github.com/dmudryk/-property-workflows/pull/2
- [ ] (З першою задачею, що має міграцію) `db-check` зелений, після merge `db-deploy` застосував її у вашу базу —
      PR задачі 1

## 8. Вимоги PM і специфікація

- [x] Адресу репо вимог PM узято з чату команди — https://github.com/solomchaak/property-workflows-spec
- [x] `/requirements-sync https://github.com/solomchaak/property-workflows-spec` → PR «Оновлення вимог» злито; шапка
      `docs/conformance.md` — `Вимоги: … · джерело: issues · знімок 2026-10-20` —
      https://github.com/dmudryk/-property-workflows/pull/1
- [x] Читання вимог: скіл `spec-clarify` → питання через вебформу — solomchaak/property-workflows-spec#16, #17, #18 →
      журнал `docs/spec-reading.md`
- [x] Переклад у специфікацію: `add-ws6-runs` → `validate --strict` → `spec-review` → archive → `/conformance` → PR
      «Специфікація» злито; `npm run ac:coverage` без «вимогу PM ще не перекладено» —
      https://github.com/dmudryk/-property-workflows/pull/2
