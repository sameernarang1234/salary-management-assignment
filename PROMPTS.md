# Prompt log

Prompts used to build this project with Claude Code, in order and verbatim.

---

## 1. Plan, data model and AI engineering rules

**Prompt**

```text
Read docs/REQUIREMENTS.md and the assessment brief. Before writing any code, create docs/PLAN.md covering:

* The tech stack : frontend -> React.js; backend -> Node.js & Express.js; Keep language as typescript. In React, use functional components. For global states, use Redux.
* The data model - employees, salary components, append-only salary history, the single HR Manager account, countries with currencies and USD rates . Use PostgreSQL database with Prisma for communicating with it.
* Key design decisions with trade-offs, and a test-first build order.
* Also create CLAUDE.md with the engineering rules the AI must follow for the rest of the project. 
* I will review everything thoroughly, so be precise and stick to the requirements and assessment docs.
* NOTE: Don’t write application code yet.
```

**Outcome:** `docs/PLAN.md` (tech stack, data model, design decisions with trade-offs, test-first build order) and `CLAUDE.md` (engineering rules for the AI). No application code.

**Commit(s):** _to be added_

---

## 2. Step 0: project setup

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 0 (project setup) only. No features, no Prisma models yet.

* npm workspaces with backend/ and frontend/ packages, TypeScript in strict mode in both, and Node 24 pinned (.nvmrc and "engines").
* backend: Express 5 with a GET /api/health endpoint, Vitest, Supertest.
* frontend: React 19 + Vite with an empty placeholder page, Vitest + React Testing Library.
* docker-compose.yml running PostgreSQL with separate dev and test databases; .env.example for both. Real .env files are git-ignored.
* Prisma installed and configured, with a datasource only and no models.
* Tests first:
  * the health endpoint returns 200;
  * the backend can connect to the test database;
  * the frontend placeholder renders.
* Root scripts: test, typecheck, format, db:up, db:migrate.
* Run the tests and typecheck and show me the results.
* Don't commit. I will commit myself with appropriate message.
```

**Outcome:** npm workspaces (backend, frontend), TypeScript strict, Node 24 pinned; Express 5 health endpoint; Prisma 7 with a datasource only; PostgreSQL 17 in Docker with `salary_dev` and `salary_test`; Vitest, Supertest and React Testing Library. Tests written first and seen failing, then 3/3 passing; typecheck clean.

**Commit(s):** _to be added_

---

## 3. Step 1: validators (business rules)

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 1 (validators) only, in backend/src/validators. Pure functions and types: no database, no Express, no Prisma imports.

* Salary component catalogue: BASIC (required), HRA, HOUSING, TRANSPORT, SPECIAL, with display names.
* Salary total: the sum of the components.
* Zod schemas, with their inferred types:
  * employee input: full name, email, job title, department, country code, hire date;
  * salary components: BASIC required, no duplicate or unknown components, whole-number amounts greater than 0, with a sensible upper limit;
  * salary change: new components, effective date, reason (annual_increment, promotion, correction, other);
  * reject a salary change whose components are identical to the current ones.
* Currency conversion: local whole-number amount × USD rate → whole USD, rounded consistently.
* Tests first, one behaviour at a time. Cover edge cases: missing Basic, duplicate component, zero, negative or decimal amounts, impossible dates (2025-02-30), invalid email, empty strings, unknown reason, rounding.
* Install Zod in the backend.
* Run the tests and typecheck and show me the results.
* Don't commit. I will commit myself.
```

**Outcome:** `backend/src/validators/`: component catalogue, `salaryTotal`, `isSameSalary`, Zod schemas for salary components, employee input and salary changes (rejects an unchanged salary), real-calendar date check, and exact integer-based USD conversion (halves round up). Upper limit of 100,000,000 per component so totals fit PostgreSQL `int`. 75 new tests written first and seen failing, then 77/77 backend tests passing; typecheck clean.

**Commit(s):** _to be added_

---

## 4. Step 2: database

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 2 (database) only. No repositories, services or API yet.

* Add the models from the PLAN.md data model to schema.prisma: countries, component_types, employees, salary_components, salary_history, users, sessions. Use the PostgreSQL types from the plan (citext, date, timestamptz, numeric(18,8), jsonb, enums).
* Create the first migration with prisma migrate dev. Add raw SQL in the migration for what Prisma can't express:
  * the citext extension;
  * CHECK constraints: annual_amount between 1 and 100,000,000 (matching the validators), users.id = 1, left_on set only when status = 'left', previous components and total null only for new_hire;
  * triggers that reject UPDATE and DELETE on salary_history.
* Insert the five component types (from the validators' catalogue) in the migration, since they are fixed reference data. Countries come later with the seed.
* Employees can never be deleted while salary rows reference them (no cascading deletes).
* Test helper: apply migrations to the test database once before the tests, and empty the tables between tests (keeping the component types).
* Tests first, against the real test database:
  * history UPDATE and DELETE are rejected;
  * a second user is rejected;
  * an unknown country is rejected;
  * an amount of 0 or above the limit is rejected;
  * an unknown component code is rejected;
  * the same email in different case is rejected;
  * left_on without status 'left' is rejected;
  * a new_hire entry with previous components, or a change without them, is rejected.
* Run the tests and typecheck and show me the results.
* Don't commit. I will commit myself.
```

**Outcome:** Seven Prisma models and the first migration (`20261118111659_init`) with raw SQL for `citext`, four named CHECK constraints, the append-only trigger on `salary_history`, and the five component types. No cascading deletes of employees, salaries or history. Test helper migrates the test database once and empties it between tests; test files run sequentially. 24 constraint tests written first and seen failing, then 101/101 backend tests passing; typecheck clean. Found that Prisma 7's `migrate dev` no longer regenerates the client, so `db:migrate` now runs `prisma generate` too.

**Commit(s):** _to be added_
