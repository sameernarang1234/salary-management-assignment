# Rules for AI coding agents (Claude Code)

Claude Code loads this file at the start of every session. These rules apply to every change in this repository.

## Read first

- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md): what we are building and what is deliberately left out.
- [`docs/PLAN.md`](docs/PLAN.md): stack, data model, design decisions and build order.
- Do not add a feature listed under "Deliberately left out". If scope must change, update `REQUIREMENTS.md` first and say so.

## Working process

1. **Test first.** Write or update a failing test, confirm it fails for the right reason, then write the code to pass it, then refactor.
2. **Never weaken or delete a test to make the suite pass.** If a test is wrong, say why before changing it.
3. **Small steps.** One behaviour per change; the suite stays green after every step.
4. **Do not commit.** The developer reviews and commits every change. Suggest a commit message (conventional prefixes: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`).
5. **Explain trade-offs** when choosing between approaches, briefly.
6. **Verify, don't assume.** Run the tests and the typechecker before saying something works. Report failures honestly.

## Tests

- Fast and deterministic: backend tests run against the PostgreSQL **test** database (`DATABASE_URL` from `.env.test`, never the dev database), with tables truncated between tests; an injected clock (no real `Date.now()` in logic), seeded random numbers, no other network calls.
- Test database rules (constraints, triggers) against real PostgreSQL. Never mock the Prisma client to make a repository test pass.
- Readable as a specification: test names describe behaviour ("rejects a salary without a Basic component").
- Cover edge cases: empty input, unknown country, duplicate email, missing Basic, page beyond the end, wrong password, expired session.
- UI tests use React Testing Library queries by role/label, and MSW to mock the API at the network boundary.

## Backend rules

- **TypeScript `strict`.** No `any` without a comment explaining why.
- **Layers point one way:** `http → services / repositories → db`; `validators/` (business rules: Zod schemas and pure functions) is pure and depends on nothing. Add a service only when there is logic beyond validation and persistence.
- **All database access lives in `repositories/`**, through the Prisma client. Services and routes never import Prisma models directly; repositories return plain TypeScript types.
- **Raw SQL only via tagged `$queryRaw` / `$executeRaw`** (parameters bound automatically). Never use `$queryRawUnsafe` / `$executeRawUnsafe` or build SQL strings from input. Sort columns come from an allow-list. Parse raw query results with Zod.
- **Schema changes only through Prisma migrations** (`prisma migrate dev --name <change>`), committed with the code. Never edit a migration that has already been committed; add a new one. `CHECK` constraints, triggers and extensions go in the migration SQL, with a test proving each one.
- **Multi-table writes use `prisma.$transaction`.**
- **Validate every input with Zod** in the HTTP layer (body, query, params). The server is the source of truth for validation.
- **Money is a whole number** in local currency. No floating point for stored amounts; round only for USD reporting and display.
- **Currency comes from the country**, never from user input.
- **Salary history is append-only.** Never write code that updates or deletes it. A salary change updates components and appends history in **one transaction**.
- **Employees are never deleted**: mark as left.
- **Every `/api` route except login requires a valid session**, checked on the server.
- **Secrets come from environment variables.** Never hard-code passwords or keys outside test fixtures and the documented local-demo defaults.
- **One error format:** `{ "error": { "code", "message", "fields"? } }` with correct status codes (400, 401, 404, 409, 500). Never leak stack traces.

## Frontend rules

- **Functional components and hooks only.** No class components.
- **Redux Toolkit** for global state (auth/session, notifications); **RTK Query** for all server data. No ad-hoc `fetch` inside components.
- Keep logic that can be pure (form validation, URL ↔ filter mapping, formatting) **out of components**, and unit-test it.
- **Directory filters, sorting and paging live in the URL.**
- **Follow the established look:** MUI theme with a warm cream background, serif headings, brown primary and green secondary, large rounded cards, pill buttons, a left sidebar and a top bar showing the page title.
- **Responsive:** permanent sidebar on desktop and a drawer on mobile; table on wide screens and cards on phones; full-screen dialogs on phones.
- **Accessible:** every input has a label, icon buttons have `aria-label`s, and loading, empty and error states are always handled.

## Naming and style

- Domain names over generic ones: `employee`, `salaryComponents`, `salaryHistory`, not `data`, `item`, `obj`.
- Prettier formatting; no unused code or commented-out blocks.

## Commands

- `docker compose up -d` (PostgreSQL) · `npm install` · `npm run db:migrate` · `npm run seed` · `npm test` · `npm run typecheck`
- After editing `schema.prisma`: `npm run db:migrate -w backend` (Prisma 7's `migrate dev` does not regenerate the client, so the script runs `prisma generate` after it). To add raw SQL, create the migration with `npx prisma migrate dev --create-only --name <change>`, edit it, then run `db:migrate`.
- Tests apply pending migrations to the test database automatically (`test/global-setup.ts`).
- Backend only: `npm test -w backend` · Frontend only: `npm test -w frontend`

## Review checklist for every AI-generated change

- Does a test fail without this change?
- Are the edge cases covered?
- Does it respect the requirements and the "left out" list?
- Is any SQL built from user input, or any `*Unsafe` Prisma call used? Is any input unvalidated?
- Does a schema change come with a new migration?
- Would a reviewer understand it without an explanation?
