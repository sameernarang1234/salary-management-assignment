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

---

## 5. Step 3: repositories

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 3 (repositories) only, in backend/src/repositories. No services, no HTTP yet.

* Each repository takes the Prisma client (or a transaction client), so services can later combine calls in one transaction.
* Repositories return plain TypeScript types, not Prisma models: dates as YYYY-MM-DD strings, USD rates as decimal strings, and salary components in the validators' shape.
* employees:
  * find by id, with current salary components, total, and the country's currency;
  * list with search (name or email, case-insensitive, partial), filters (country, department, job title), sort (name, job title, department, country, hire date; ascending or descending, with id as a tie-breaker), and page/page size. Return the items and the total count. Leavers are excluded unless asked for;
  * insert, update details, mark as left (status and left_on);
  * a duplicate email raises a clear "email already in use" error, not a raw Prisma error.
* salary components: get for an employee, replace all for an employee.
* salary history: append an entry, list an employee's entries newest first.
* countries: list all, find by code.
* filter options: distinct departments and job titles of active employees.
* Tests first, against the test database:
  * search matches part of a name or email in any case;
  * % and _ in the search are treated as literal characters;
  * SQL injection text in search or filters returns no rows and causes no error;
  * filters combine;
  * each sort order works, and ties are ordered by id;
  * a page beyond the end returns no items but the correct total;
  * leavers are hidden by default and shown when asked;
  * a duplicate email in different case gives the "email already in use" error;
  * replacing components removes old ones;
  * history comes back newest first.
* Run the tests and typecheck and show me the results.
* Don't commit. I will commit myself.
```

**Outcome:** Repositories for employees (directory list with escaped search, filters, allow-listed sorting with id tie-breaker, paging; find by id; insert, update, mark as left), salary components (atomic replace, catalogue order), salary history (append, newest first, snapshots re-validated on read), countries and filter options. `EmailInUseError` replaces raw Prisma errors; `inTransaction` lets services join one transaction. Tests showed Prisma does not escape `%`/`_` in `contains`, so the repository escapes them. 54 tests written first and seen failing, then 155/155 backend tests passing; typecheck clean.

**Commit(s):** _to be added_

---

## 6. Step 4: salary service

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 4 (salary service) only, in backend/src/services. No HTTP yet.

* Services take the Prisma client and an injected clock (no real Date.now() in logic), and use the validators and repositories. They never query the database directly.
* Clear service errors that the API can later turn into status codes: validation failed (with errors per field), employee not found, unknown country, email already in use, employee already left.
* create employee: validate details and first salary components, check the country exists, then in one transaction insert the employee, save the components, and append a new_hire history entry (effective date = hire date). Hire date can't be in the future.
* update employee details: validate, check the country exists. Salary is not changed here.
* change salary: in one transaction, lock the employee row (so two changes at the same time can't both read the same old salary), load the current components, validate with the salary change schema, replace the components, and append one history entry with previous and new components and totals. Reject an employee who has left, an effective date before the hire date, and an effective date in the future.
* mark as left: set the leaving date. Reject an employee who has already left, and a date before the hire date or in the future.
* Tests first, against the test database:
  * creating an employee writes exactly one new_hire entry with the right totals;
  * a salary change writes exactly one entry with the correct previous and new values;
  * an unchanged salary is rejected and writes nothing;
  * if appending history fails, the component change is rolled back (and the same for create);
  * an unknown employee, unknown country, duplicate email, leaver, or invalid dates give the right error;
  * two salary changes at the same time both end up in history, each with the correct previous values.
* Run the tests and typecheck and show me the results.
* Don't commit. I will commit myself.
```

**Outcome:** Services for create employee, update details, change salary and mark as left, each in one transaction; the salary change and leaving lock the employee row (`SELECT … FOR UPDATE`, in the employees repository). Injected clock; named service errors (`ValidationError` with field errors, `EmployeeNotFoundError`, `DuplicateEmailError`, `EmployeeLeftError`). Rollback proven by forcing the history write to fail; the concurrency test was shown to fail with the lock removed. 31 tests written first and seen failing, then 186/186 backend tests passing; typecheck clean.

**Commit(s):** _to be added_

---

## 7. Step 5: insights service

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 5 (insights service) only, in backend/src/services and backend/src/repositories. No HTTP yet.

* Do all aggregation in PostgreSQL using Prisma's tagged $queryRaw, and check every raw result with Zod. Include active employees only.
* Overview: headcount, total annual payroll in USD, median salary in USD, and headcount per fixed USD salary band (include empty bands; a salary exactly on a boundary goes in the higher band).
* Pay by country: headcount and min / median / average / max in local currency, plus average and total cost in USD; most expensive country first.
* Pay by job title within one country: headcount and min / median / average / max in local currency. Reject an unknown country.
* Cost by department: headcount, total and average in USD; most expensive department first.
* Round medians and averages half up, consistent with toUsd (PostgreSQL rounds floating-point halves to even, so round as numeric).
* Tests first, against the test database, with a small hand-calculated dataset that includes a highly paid leaver:
  * leavers are excluded from every figure;
  * totals, medians and averages match the hand-calculated answers;
  * empty bands are listed, and a salary on a band boundary goes in the higher band;
  * no employees gives zeros and no median;
  * allowances count towards the salary, not only Basic;
  * halves round up (100,000.5 → 100,001);
  * an unknown country is rejected.
* Run the tests and typecheck and show me the results.
* Don't commit. I will commit myself.
```

**Outcome:** Insights repository with all aggregation in PostgreSQL (`percentile_cont` for medians, `width_bucket` for the eight USD salary bands), raw results validated with Zod; insights service for the overview, pay by country, pay by job title in a country and cost by department. Medians and averages rounded half up as `numeric`. 13 tests written first against a hand-calculated dataset and seen failing, then 199/199 backend tests passing; typecheck clean.

**Commit(s):** _to be added_

---

## 8. Step 6: authentication

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 6 (authentication) only.

* Hash passwords with node:crypto scrypt, storing the parameters and a random salt with the hash. Compare in constant time; a malformed stored hash must fail safely, not crash.
* Login creates a random session token sent in an httpOnly, SameSite=Strict cookie (Secure in production). Store only a SHA-256 hash of the token. Sessions last 8 hours; remove expired sessions.
* An unknown email and a wrong password give the same error and take about the same time, so emails can't be discovered.
* Routes: POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me.
* Every other /api route requires a valid session, checked on the server. Keep /api/health public for hosting health checks. An unknown route returns 401 when signed out and 404 when signed in.
* One error format for every error, including invalid JSON; never send stack traces.
* createApp takes its dependencies (database, clock, secure-cookie setting), so tests use the test database and a fixed clock. The server reads its settings from environment variables, checked with Zod.
* Tests first:
  * password hashing: right and wrong passwords, a new salt each time, malformed stored hashes;
  * login: success, wrong password, unknown email (same error), email in any case, only the token hash stored;
  * sessions: valid, just before expiry, expired, missing or made-up cookie;
  * logout ends the session and clears the cookie;
  * cookie flags (HttpOnly, SameSite=Strict, Secure in production);
  * every protected route returns 401 without a session.
* Run the tests and typecheck and show me the results.
* Don't commit. I will commit myself.
```

**Outcome:** scrypt password hashing (`scrypt$N$r$p$salt$hash`, constant-time comparison); server-side sessions with only the SHA-256 token hash stored, 8-hour lifetime, expired sessions cleaned up at login; login, logout and me routes; a `requireSession` guard on every other `/api` route; one error handler for the standard error format; dependency-injected `createApp({ db, clock, secureCookies })`. Real server smoke-tested. 49 tests written first and seen failing, then 248/248 backend tests passing; typecheck clean.

**Commit(s):** _to be added_

---

## 9. Step 7: HTTP API

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 7 (HTTP API) only, in backend/src/http.

* Endpoints, all requiring a session:
  * GET /api/employees: the directory, with search, country, department and job title filters, sort, order, page, page size (max 100) and an option to include leavers;
  * POST /api/employees: add an employee with their first salary;
  * GET /api/employees/export: CSV of the filtered directory;
  * GET and PUT /api/employees/:id: details, and edit details;
  * POST /api/employees/:id/salary: change salary;
  * GET /api/employees/:id/history: salary history, newest first;
  * POST /api/employees/:id/leave: mark as left;
  * GET /api/insights/overview, /countries, /countries/:code/job-titles, /departments;
  * GET /api/meta: countries, the component catalogue, change reasons, sort fields, filter options and the rates date.
* Validate every query string, id and body with Zod. Map service errors to 400, 401, 404 and 409 in the one error format, with errors per field.
* Directory rows and employee details include the total in USD, calculated with toUsd.
* The CSV opens correctly in Excel (UTF-8 byte order mark), quotes values per RFC 4180, protects against formula injection, and is named with today's date.
* Keep the countries and their dated USD rates in one reference file, for /api/meta now and the seed later.
* Tests first, with Supertest, for every endpoint and error path: success, invalid query or body, unknown id, duplicate email, unchanged salary, leaver, CSV contents and formula protection.
* Run the tests and typecheck and show me the results.
* Don't commit. I will commit myself.
```

**Outcome:** Employee, salary, history, leave, CSV export, insights and meta endpoints, all session-protected, with Zod validation of every query, id and body and the one error format. A directory service adds exact USD totals to the list, details and CSV. The CSV has a byte order mark, RFC 4180 quoting and formula-injection protection. Reference countries with rates dated 2026-01-01 in `referenceData/countries.ts`. 50 tests written first and seen failing, then 298/298 backend tests passing; typecheck clean.

**Commit(s):** _to be added_

---

## 10. Step 8: seed

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 8 (seed) only, in backend/src/seed.

* A deterministic generator: seeded random numbers and a fixed reference date, so every run produces exactly the same data.
* Generate 10,000 realistic employees across the reference countries:
  * local names, job titles in departments, and salaries scaled to each country's pay level;
  * salary components structured the way each country usually pays (for example HRA in India, Housing in the UAE and Singapore);
  * salary history: a new_hire entry on the hire date, yearly reviews on 1 April, occasional promotions and corrections;
  * about 5% leavers, leaving after their last salary change.
* Every generated record must pass the API's own validators, and emails must be unique.
* A seed script (npm run seed) that replaces all data in one transaction and creates the HR Manager account from HR_MANAGER_EMAIL and HR_MANAGER_PASSWORD (local-demo defaults documented in .env.example).
* It must run in seconds. Keep bulk inserts in the repositories, using bound parameters only.
* Tests first:
  * the same seed gives the same data, and a different seed gives different data;
  * every record passes the validators; emails are unique;
  * each history starts with new_hire on the hire date, chains each previous salary to the one before, and ends at the current salary;
  * nothing is dated after the reference date;
  * re-seeding gives the same result, the HR Manager can sign in, and new employees get the next id.
* Seed the development database, then measure the directory and insights endpoints against the 200 ms target.
* Run the tests and typecheck and show me the results.
* Don't commit. I will commit myself.
```

**Outcome:** A seeded generator (mulberry32, fixed date 2026-10-31) of 10,000 employees in 10 countries and 18 roles. The seed loads 30,621 components, 66,457 history entries and 453 leavers in one transaction, plus the HR Manager account. The first version took 69 s because of Prisma `createMany`; switching the bulk inserts to one JSON parameter per batch expanded with `jsonb_to_recordset` brought it to 11.5 s with identical data. Measured against 10,000 employees, directory and insights respond in 28–91 ms. 23 tests written first and seen failing, then 321/321 backend tests passing; typecheck clean.

**Commit(s):** _to be added_

---

## 11. Step 9: frontend foundation

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 9 (frontend foundation) only, in frontend/src.

* MUI theme and layout following the look of my earlier projects: cream background, serif headings, brown and green palette, large rounded cards, pill buttons, a left sidebar (a drawer on phones) and a sticky top bar showing the page title.
* Redux Toolkit store, created fresh for the app and for each test, with slices for the session and app-wide notifications.
* One RTK Query API slice for all server data. A 401 on any request other than login, logout or "who am I" means the session has expired: sign the HR Manager out and show a message.
* Sign-in page: check the fields before sending, show the server's message for a wrong password, and return to the page that was asked for after signing in.
* Protected routes for every page except sign-in. Signing out clears all cached data. Unknown addresses go to the insights page.
* Pages load on demand.
* Tests first, with React Testing Library and MSW mocking the API:
  * the sign-in form's checks, without calling the API;
  * a signed-out visitor is sent to sign in, then returned to the page they asked for;
  * a wrong password shows the server's message;
  * signing out returns to the sign-in page;
  * an expired session sends the HR Manager to sign in again with a message;
  * the phone layout hides the sidebar behind a menu button.
* Run the tests, typecheck and build, check it in the browser on desktop and phone sizes, and show me the results.
* Don't commit. I will commit myself.
```

**Outcome:** MUI theme and responsive layout matching the earlier projects; Redux Toolkit store with session and notifications slices; an RTK Query API slice whose base query turns a 401 into "session expired"; sign-in page, `RequireAuth` protected routes and pages loaded on demand. The test setup gained a `matchMedia` stand-in (jsdom has none), and MSW 3's `onUnhandledFrame: 'error'` (renamed from `onUnhandledRequest`) makes any unhandled request fail. Checked in the browser on desktop and phone sizes. 19 tests written first and seen failing, then 20/20 frontend tests passing; typecheck and build clean.

**Commit(s):** _to be added_

---

## 12. Step 10: employee directory

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 10 (employee directory) only, in frontend/src/features/employees.

* Search by name or email (sent once typing pauses), filters for country, department and job title, a "Show leavers" switch, sorting and paging.
* Keep all of these in the URL, so a view can be refreshed or shared. Write the URL ↔ query mapping as pure, tested functions: invalid values fall back to defaults, defaults are left out of the URL, and changing a filter or the sort returns to page 1.
* A sortable table on wide screens and cards on narrow ones. Show each salary in local currency with the USD equivalent; mark leavers; link each name to the employee's details page.
* An "Export CSV" button for the current filters and sort.
* Loading, empty (with a way to clear the filters) and error (with Retry) states.
* Tests first, with React Testing Library and MSW:
  * the URL ↔ query functions, including invalid values and round trips;
  * money and date formatting;
  * the list shows names, job titles, countries and salaries in local currency and USD;
  * filters, search, sorting and paging update the URL and the API request;
  * leavers appear only when asked for;
  * the export link carries the current filters;
  * empty and error states; cards on a phone.
* Run the tests, typecheck and build, check it in the browser against the seeded data, and show me the results.
* Don't commit. I will commit myself.
```

**Outcome:** The employee directory with search, filters, the "Show leavers" switch, sorting and paging kept in the URL (pure `directoryQuery` functions); a table on wide screens and cards on narrow ones; salaries in local currency with the USD equivalent; CSV export link; loading, empty and error states. The browser check against 10,000 employees found the table didn't fit at 1024 px beside the sidebar, so the table now starts at 1200 px and the department moved under the job title. Rechecked: the table fits exactly at 1280 px, and the CSV export returned all 3,379 Indian employees. Tests written first and seen failing, then 57/57 frontend tests passing; typecheck and build clean.

**Commit(s):** _to be added_

---

## 13. Step 11: employee details and forms

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 11 (employee details) only, in frontend/src/features/employees.

* Details page, opened from the directory: the employee's details, salary breakdown by component with the total, the USD equivalent with its rate and rates date, and the salary history newest first, with each change's reason, effective date and percentage. An unknown employee shows "not found" with a link back.
* Dialogs, full screen on phones:
  * Add employee, from the directory: details and first salary, with a live total in the chosen country's currency; then open the new employee's page;
  * Edit details;
  * Change salary: current components prefilled, effective date, reason, and a live new total with the difference;
  * Mark as left: a leaving date, saying the record and history are kept.
* Leavers can't have their salary changed or be marked as left again.
* Write the form rules as pure, tested functions that mirror the server: Basic required, whole amounts within the limit, valid dates not in the future or before the hire date, and no unchanged salary.
* Show the server's field errors next to the right field, including errors about one component (for example components.1.annualAmount); show other errors as an alert in the dialog.
* After any change, refresh exactly the affected data (the employee, their history, the directory, the insights) and show a confirmation.
* Tests first, with React Testing Library and MSW:
  * the form-rule functions;
  * the details page, breakdown and history;
  * changing salary sends the right request, checks the form before sending, and shows server field errors and a 409 "has left" error;
  * editing details, including a duplicate email;
  * marking as left;
  * adding an employee from the directory.
* Run the tests, typecheck and build, check the real server path end to end, and show me the results.
* Don't commit. I will commit myself.
```

**Outcome:** The employee details page (breakdown, USD equivalent with rate and rates date, history timeline, leaver banner, not-found state) and four dialogs that go full screen on phones: add employee (from the directory), edit details, change salary and mark as left. Form rules live in pure `salaryForm` and `employeeForm` modules (28 tests). Server field errors are mapped back to the right input, including errors about one component. RTK Query cache tags refresh exactly the affected data after each change. Checked the real server path end to end (unchanged salary 400, future date 400, valid promotion 201 with history updated), then re-seeded. Tests written first and seen failing, then 97/97 frontend tests passing; typecheck and build clean.

**Commit(s):** _to be added_

---

## 14. Step 12: insights page

**Prompt**

```text
Follow CLAUDE.md and docs/PLAN.md. Implement Step 12 (insights page) only, in frontend/src/features/insights.

* Answer the HR Manager's pay questions on one screen, for active employees:
  * headline figures: headcount, total annual payroll and median salary in USD, with the rates date;
  * salary distribution: a chart of headcount per USD salary band;
  * pay by country: min / median / average / max in local currency, with average and total cost in USD, most expensive first;
  * pay by job title within a chosen country (starting with the most expensive country), in local currency;
  * cost by department: a chart and a table of headcount, total and average in USD.
* Use Recharts for the charts, and give each chart a table of the same data that screen readers can read. Load the charts library only with this page.
* Loading, error (with Retry) and empty states; with no active employees, explain that there is nothing to show yet.
* The figures refresh automatically after any salary change, edit or leaver.
* Tests first, with React Testing Library and MSW:
  * the headline figures and the rates date;
  * the distribution data;
  * pay by country, in order, in local currency and USD;
  * pay by job title, including switching country;
  * cost by department;
  * the empty and error states.
* Run the tests, typecheck and build, check the figures against the seeded data in the browser, and show me the results.
* Don't commit. I will commit myself.
```

**Outcome:** The insights page: headline figures, a salary distribution chart, pay by country, pay by job title within a chosen country and cost by department (chart and table). Each chart has a table of the same data for screen readers, and Recharts loads only with this page (108 kB gzipped). Checked against the seeded data: 9,547 employees, $651.4M payroll, $61,198 median; the distribution bands and the countries' headcounts each add up to 9,547. 7 tests written first and seen failing, then 104/104 frontend tests passing; typecheck and build clean.

**Commit(s):** _to be added_

---

## 15. Employees page: multi-select filters, salary sort, status filter

**Prompt**

```text
Make the following modification in the code:

* In Employees page, Country, Department and Job title are single select fields, in which, only one entry can be selected at a time. Make them multiple select fields, in which, more than one entry can be selected at any given time.
* Just like we have the sorting functionality in the Employees table for Employee Name column, add the similar functionality for Annual Salary Column. Since salaries for different countries can be in different currencies, use USD as the common currency for implementing the sorting functionality.
* Instead of the "Show Leavers" toggle button, add another filter, similar to already available filters, with options as "Active Employees", "Previous Employees", "Show All". Use suitable names to be displayed on screen for these options. For all the previous / ex-employees, the ones who have left, show an appropriate indicator, like, an i button showing an appropriate message on hover, or, a different font, or both, or whichever other approach seems better. I'll review this, as well as other changes.
```

**Outcome:** Country, Department and Job title are multi-select filters (repeated URL and API parameters, any value matches, up to 50 per filter). The Annual salary column sorts by each employee's total converted to USD, so different currencies compare fairly; the directory list became one parameterised SQL query (allow-listed sort columns, bound values, results checked with Zod) because Prisma can't sort by that calculated total. The "Show leavers" switch was replaced by an "Employees to show" filter (Current, Former, All employees); former employees are shown in muted italics with a "Former" chip and an info button whose tooltip gives the leaving date. REQUIREMENTS.md and PLAN.md updated. Tests written first and seen failing, then 335/335 backend and 107/107 frontend tests passing; directory calls measured at 23–58 ms with 10,000 employees.

**Commit(s):** _to be added_

---

## 16. Employees page: last working day of former employees

**Prompt**

```text
In the Employees page, when former employees, or, all employees, is selected, show the last working date of the former employee as well, along with the marker.
```

**Outcome:** Former employees show "Last working day: <date>" in muted italics under their name and email, in both the table and the phone cards, alongside the "Former" chip and info button; current employees don't get the line. Frontend only: directory rows already carried the leaving date. Tests updated first and seen failing; a flaky existing test (clicking "Add employee" before the countries had loaded, while the button is deliberately disabled) now waits for the button to be enabled. 108/108 frontend tests passing; typecheck clean.

**Commit(s):** _to be added_

---

## 17. Insights page: chart axis titles

**Prompt**

```text
In the insights page, in the bar graphs, add x axis and y axis labels, indicating the data point shown on those axis, example "employee count", or, "salary range" etc.
```

**Outcome:** Axis titles on both bar charts: the salary distribution ("Salary range (USD per year)" across, "Number of employees" up) and cost by department ("Total annual cost (USD)" across, "Department" up). Tests written first and seen failing; they give Recharts a fixed size in jsdom so the real chart renders. A browser check measured every title against every tick label: no overlaps at 1280 px, but at phone width the department title was clipped and the salary ranges ran into each other. On phones, the department column now narrows and the salary ranges tilt more steeply in a smaller font. 110/110 frontend tests passing; typecheck and build clean.

**Commit(s):** _to be added_

---

## 18. Insights page: no horizontal scrolling

**Prompt**

```text
Now the employees page is fine, since there is no horizontal scroll, and everything fits well in the viewport. But insights page has a horizontal scroll. Remove it, and keep everything within the viewport.
```

**Outcome:** Measured in the browser first. The cause was the hidden screen-reader table behind the distribution chart: its `width: 1` meant 100% in MUI's `sx`, so it was 1,265 px wide and stuck out past the screen. It's now `'1px'`, with a test on its computed size. Three tables also scrolled sideways inside their cards. Pay by country and Pay by job title merged min and max into one Range column, with tighter cell padding, and show one card per row below 1200 px. Cost by department's table moved under its chart, and shows cards on phones. Checked at 1280, 1200, 1024, 768 and 375 px: no sideways scrolling, and no table or card wider than its space. Tests written first and seen failing, then 114/114 frontend tests passing; typecheck and build clean.

**Commit(s):** _to be added_
