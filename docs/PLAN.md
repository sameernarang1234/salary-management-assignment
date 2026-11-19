# Plan and design notes: ACME Salary Management

Written after [REQUIREMENTS.md] and before any application code.

## Tech stack

The role is Software Craftsperson: Node / React / TypeScript, so the stack follows it. TypeScript is used end to end in `strict` mode.

- Language: TypeScript (frontend and backend). One language across the stack; types catch whole classes of bugs before tests run.
- Backend runtime: Node.js 24 (LTS). Matches the role.
- Backend framework: Express 5. Minimal and well known; v5 forwards errors from async handlers to the error middleware without wrappers.
- Validation: Zod. One schema gives runtime validation and the static type, shared by the API and tests.
- Database: PostgreSQL 17. Production-grade relational database: real `CHECK` constraints, triggers, case-insensitive text (`citext`), `percentile_cont` for medians, concurrent writes. Runs locally with one `docker compose up`.
- Database access: Prisma (ORM + migrations). Typed client generated from one `schema.prisma`, so queries are checked by the compiler; versioned SQL migrations; parameterised queries by default. Features Prisma's schema can't express (`CHECK`, triggers, `citext`) are added as raw SQL inside the migrations.
- Password hashing: `node:crypto` scrypt. Built into Node (no native add-on), memory-hard, suitable for passwords.
- Frontend: React 19 with functional components and hooks only. Required by the brief; no class components.
- Build tool: Vite. Fast dev server and build; proxies `/api` to Express in development.
- Global state: Redux Toolkit. Auth/session state and app-wide UI state (e.g. notifications) in typed slices.
- Server data: RTK Query (part of Redux Toolkit). Keeps API data in the same Redux store: caching, loading/error states, and cache invalidation after edits (e.g. a salary change refreshes the directory, details page and insights).
- Routing: React Router. Directory filters live in the URL so views can be refreshed and shared.
- Component library: MUI (Material UI). Accessible components and a responsive grid; themed to match the look of my previous projects (warm cream background, serif headings, brown/green palette, rounded cards, sidebar + top bar).
- Charts: Recharts. Declarative charts for the insights page.
- Tests: Vitest, Supertest (HTTP), React Testing Library, MSW (mock the API at the network boundary in UI tests). One fast runner for both packages; UI tests exercise real Redux/RTK Query code paths. Backend tests run against a real PostgreSQL test database (Docker locally, a service container in CI), with tables truncated between tests, so constraints and triggers are tested for real rather than mocked.
- Repo layout: npm workspaces, `backend/` and `frontend/`. One install, one test command, independent packages.

## Data model

```mermaid
erDiagram
  COUNTRIES ||--o{ EMPLOYEES : "employs in"
  EMPLOYEES ||--|{ SALARY_COMPONENTS : "is paid"
  COMPONENT_TYPES ||--o{ SALARY_COMPONENTS : "categorises"
  EMPLOYEES ||--|{ SALARY_HISTORY : "has"
  USERS ||--o{ SESSIONS : "signs in with"

  COUNTRIES {
    char code PK "ISO 3166 alpha-2, e.g. IN"
    text name
    char currency "ISO 4217, e.g. INR"
    decimal usd_per_unit "static reference rate, numeric(18,8)"
  }
  COMPONENT_TYPES {
    text code PK "BASIC, HRA, HOUSING, TRANSPORT, SPECIAL"
    text name
    boolean is_required "true only for BASIC"
  }
  EMPLOYEES {
    int id PK
    text full_name
    citext email UK "case-insensitive"
    text job_title
    text department
    char country_code FK
    date hire_date
    enum status "active | left"
    date left_on "nullable"
    timestamptz created_at
    timestamptz updated_at
  }
  SALARY_COMPONENTS {
    int employee_id PK, FK
    text component_code PK, FK
    int annual_amount "whole local units, > 0"
  }
  SALARY_HISTORY {
    int id PK
    int employee_id FK
    date effective_date
    enum reason "new_hire | annual_increment | promotion | correction | other"
    jsonb previous_components "null for new hire"
    jsonb new_components
    int previous_total "null for new hire"
    int new_total
    timestamptz recorded_at
  }
  USERS {
    int id PK "CHECK id = 1: one account"
    citext email UK
    text password_hash "scrypt, with salt"
    timestamptz created_at
  }
  SESSIONS {
    text token_hash PK "SHA-256 of the cookie token"
    int user_id FK
    timestamptz expires_at
  }
```

Notes on the model:

- Schema: It lives in `backend/prisma/schema.prisma`; every change is a Prisma migration committed to the repo. Rules Prisma's schema language can't express are added as raw SQL in the migration files: `CHECK` constraints (`annual_amount` between 1 and 100,000,000, `users.id = 1`, `left_on` set if and only if `status = 'left'`, previous components and total null only for `new_hire`), the append-only triggers, the `citext` extension, and the five fixed component types. Foreign keys never cascade deletes to employees, salaries or history.
- Current salary: The rows in `salary_components` for an employee; the total is their sum (computed in SQL, never stored, so it can't drift).
- Currency: Not stored on the employee. It comes from `countries`, so an employee in India can't be "paid in EUR" by mistake.
- USD figures: Computed as `ROUND(total × usd_per_unit)`, using the dated rate. The rates date is shown in the UI.
- Salary history: Append-only. PostgreSQL triggers raise an error on any `UPDATE` or `DELETE` of `salary_history`, so the rule holds even if application code (or someone in a SQL console) gets it wrong. `TRUNCATE` skips row triggers; the application never truncates, and in production its database role should not have the `TRUNCATE` privilege. Old and new components are stored as `jsonb` snapshots, so an entry stays readable even if the component catalogue changes later.
- Creating an employee: Writes the first history entry (`new_hire`), so every employee's history starts at their first salary.
- Mark as left: Sets `status = 'left'` and `left_on`; rows are never deleted. Directory, insights and CSV export only include `active` employees by default.
- One account: Enforced by `CHECK (id = 1)` on `users`; the seed script creates it from environment variables. There is no sign-up endpoint.
- Sessions: Stored server-side; the browser holds a random token in an `httpOnly`, `SameSite=Strict` cookie, and only a hash of the token is stored, so a leaked database doesn't leak live sessions.
- Indexes (declared in `schema.prisma`): `employees(status, country, job_title)`, `employees(department)`, `employees(full_name)`, `salary_history(employee_id, effective_date)`. Name/email search uses `ILIKE`; a `pg_trgm` index is the next step if search ever gets slow (not needed at 10k).

## Key design decisions and trade-offs

- PostgreSQL (instead of SQLite, which the brief suggests): Real constraints, triggers and concurrent writes; the same database in development, tests, CI and production; scales well beyond 10k. Trade-off: Reviewers need Docker (or a Postgres install) to run it; tests are slower than in-memory SQLite and must clean up between cases.
- Prisma: Typed queries and versioned migrations from one schema file; injection-safe by default. Trade-off: Can't express `CHECK`/triggers/`citext` in its schema (raw SQL in migrations); aggregates such as median need `$queryRaw`; a generated client and an extra build step.
- Whole-number amounts: No floating-point money errors; annual salaries aren't paid in cents. Trade-off: Can't store fractional amounts.
- Components in their own table: Breakdown, totals and validation ("Basic is required") are simple queries. Trade-off: Totals need a `SUM` join; covered by indexes.
- History as JSON snapshots: An entry is a complete, readable record of before/after. Trade-off: Harder to query inside old entries; not needed in v1.
- Salary change = one transaction (update components + append history): The two can never disagree. Trade-off: None meaningful.
- Effective date recorded, not scheduled: Changes apply immediately; the date says when it counts from. Trade-off: No future-dated changes in v1.
- Server-side sessions (not JWT): Logout really revokes access; simple to test. Trade-off: A session lookup per request (indexed, sub-millisecond).
- Soft delete ("left"): History is never lost. Trade-off: Every query must filter by status; done in one place in the repository.
- Static exchange rates: Reproducible reports. Trade-off: Rates need a manual update.
- Aggregates in PostgreSQL (`percentile_cont(0.5)` for median, `min`/`avg`/`max`, `GROUP BY`) via `$queryRaw` tagged templates: Only small result rows leave the database; fast at any size. Trade-off: Raw SQL isn't type-checked by Prisma, so results are parsed with Zod and covered by tests with hand-calculated answers.
- Redux for app state, RTK Query for server data: Uses Redux as requested without hand-writing loading/caching logic. Trade-off: More setup than plain hooks for a small app.
- Express serves the built frontend in production: One deployable service, no CORS. Trade-off: Static files would ideally sit on a CDN.
- Directory list as one parameterised SQL query (`$queryRaw`): Sorting by annual salary needs the component total converted to USD, which Prisma's query builder can't express. Trade-off: Not type-checked by Prisma: results are parsed with Zod; sort columns come from an allow-list and every value is a bound parameter.
- Offset pagination (`LIMIT`/`OFFSET`): "Page 3 of 400" and totals are what HR expects. Trade-off: Slower for very deep pages on huge tables; not an issue at 10k.

## Architecture (backend)

```
http/          Express routes, auth middleware, error handler (Zod validates every input)
  ↓
services/      use cases with logic: salary changes (transaction + history), insights, auth
  ↓
repositories/  all database access through the Prisma client (and $queryRaw for aggregates)
  ↓
prisma/        schema.prisma, migrations (incl. raw SQL for CHECKs and triggers), seed

validators/    business rules: Zod schemas, pure functions and types, used by every layer, depends on nothing
```

`createApp({ prisma, clock })` wires everything together, so tests pass a Prisma client connected to the test database and a fixed clock. Services that change more than one table use `prisma.$transaction`.

## Test-first build order

Each step: Write failing tests → make them pass → refactor → commit. Every commit keeps the suite green.

0. Project setup: Workspaces, TypeScript strict, Vitest, Prettier, `docker-compose.yml` with PostgreSQL (dev + test databases), Prisma installed, CI (GitHub Actions with a Postgres service container). Tests first: A trivial test proves the runner works in both packages and that the backend can connect to the test database.
1. Validators: Component catalogue and salary totals, employee and salary-change validation (Zod), statistics (min/median/mean/max), currency conversion. Tests first: Pure unit tests, including edge cases (missing Basic, duplicate component, zero or negative amounts, impossible dates, empty lists).
2. Database: `schema.prisma`, first migration with raw-SQL `CHECK`s, append-only triggers and `citext`; test helper that migrates and truncates the test database. Tests first: Constraint tests against real PostgreSQL: history `UPDATE`/`DELETE` rejected, second user rejected, unknown country rejected, non-positive amount rejected, duplicate email in different case rejected.
3. Repositories: Employees (search, filters, sort, paging, active only), components, history. Tests first: Against the test database, including injection attempts in search and sort, and `%`/`_` wildcard escaping in `ILIKE`.
4. Salary service: Create employee (+ first history entry), change salary (one transaction), mark as left. Tests first: Rollback when part of a change fails; history written exactly once; no change when nothing differs.
5. Insights service: Summary, by country, by job title in a country, by department, distribution. Tests first: Known small data sets with hand-calculated answers; leavers excluded.
6. Auth: Password hashing, login, logout, session middleware. Tests first: Wrong password, expired session, missing cookie → 401; every `/api` route except login is protected.
7. HTTP API: Employees, salary changes, history, insights, CSV export, meta; one error format. Tests first: Supertest for every endpoint and error path (400 / 401 / 404 / 409).
8. Seed (`prisma db seed`): Deterministic generator (seeded random numbers), 10,000 employees with components and history inserted in batches with `createMany`, the HR Manager account. Tests first: Same seed → same data; every row passes the API's validation; unique emails; runs in under a few seconds.
9. Frontend foundation: Vite, MUI theme and responsive layout, Redux store, RTK Query API slice, login page, protected routes. Tests first: Login form validation; redirect to login when the session is missing.
10. Directory: Search, filters, sorting and paging in the URL; table ↔ cards; CSV export. Tests first: URL ↔ query mapping (pure); page renders results via MSW.
11. Employee details: Breakdown by component, history timeline, edit details, change salary, mark as left. Tests first: Salary-change form (components, reason, effective date); server errors shown next to fields.
12. Insights page: KPIs, pay by job title in a country, by country, by department, distribution. Tests first: Formatting helpers; sections render with mocked data.
13. Ship: Production build, Dockerfile (runs `prisma migrate deploy` on start), deploy with a managed PostgreSQL, README, architecture and trade-off docs with measured performance, demo video. Tests first: Smoke test of the production build.

## Definition of done (every step)

- Tests written first, failing for the right reason, then passing.
- `npm test` and `npm run typecheck` green.
- No requirement contradicted; if scope changes, `REQUIREMENTS.md` is updated first.
- A small commit with a clear message.
