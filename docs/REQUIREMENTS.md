# Requirements: ACME Salary Management

One page, written before any code.

## Goal

ACME's HR team manages salary data for 10,000 employees in multiple countries using spreadsheets, which is slow and error-prone. Build web software that lets the **HR Manager**:

1. Manage salary records: Find, view, add and edit employees and their salary components, and mark employees as left, without spreadsheets.
2. Answer questions about how the organisation pays people, such as "What do we pay a Software Engineer in India?", "Which country costs us the most?" or "Which department costs us the most?".
3. Track salary history: Every change to an employee's salary is logged (increments, promotions, corrections), so the HR Manager can see how each person's pay has changed over time.

Success criteria: The HR Manager finds any employee in a few seconds, updates a salary in one form, sees an employee's full salary breakdown and history in one click, and answers common pay questions from one screen, without exporting data or building pivot tables.

## Persona

HR Manager of the org (the only user): Comfortable with Excel but not technical, mostly on a laptop and sometimes on a phone. Numbers must be trustworthy: a wrong salary is much worse than a slow page.

## Scope and features (v1)

- Login: A single HR Manager account (email and password), created by the seed script; there is no sign-up. Salary data is sensitive, so every page and API call requires the signed-in HR Manager.
- Employee directory: Server-side search (name, email), filters (country, department, job title), sorting and pagination. Replaces scrolling a 10,000-row sheet.
- Add and edit employees with validation (required fields, valid and unique email, known country, valid salary components).
- Mark as left instead of deleting: The employee leaves the active directory, insights and exports, but their record and salary history are kept.
- Salary components: Each salary is made of components from a fixed catalogue (Basic is required; allowances such as House Rent, Housing, Transport and Special allowance are optional). Total annual salary is the sum of the components.
- Employee details page: Opens when an employee is clicked in the directory; shows their details, salary breakdown by component, and salary history.
- Salary history: Every salary change records the old and new components and totals, the effective date, a reason (annual increment, protion, correction or other), and when the change was made. History entries cannot be edited or deleted.
- Local currencies: Salaries are stored in the employee's country currency; a dated reference rate converts them to USD, because org-wide comparisons need one unit.
- Insights overview: Headcount, total annual payroll (USD), median salary (USD) and salary distribution: "how do we pay people?" at a glance.
- Pay by country: Headcount and min / median / average / max (local currency), plus average in USD. The main comparison in a multi-country org.
- Pay by job title within a country: Min / median / average / max, for benchmarking offers and spotting pay-equity outliers.
- Headcount and cost by department (USD), for budget discussions.
- CSV export of the filtered directory. HR still shares data in Excel; cheap and immediately useful.
- Seed script creating 10,000 realistic employees with salary components and some history, the same data every run. Enables reproducible demos and tests.
- Responsive UI: Table on desktop, cards on phones, because the HR Manager sometimes works on a phone.

## Deliberately left out, and why

- Multiple users, roles and permissions: The brief defines one persona, the HR Manager, so v1 has exactly one account and no sign-up, keeping the attack surface small. Per-person accounts with roles (e.g. read-only access for finance) are the first v2 addition: the server already checks the signed-in user on every request, so a role check slots in there.
- OAuth / single sign-on: Needs an external identity provider configured, and reviewers must be able to log in to the demo. The login is kept separate from the rest of the code, so SSO can replace it later.
- Bonuses, benefits, equity, payroll and tax: One-off and variable pay are a different problem (*paying* people rather than *understanding* fixed pay). History tracks changes to fixed salary only.
- Spreadsheet import: The seed script stands in for migration. A safe import (column mapping, validation report, partial failures) is a project of its own.
- Live exchange rates: Rates change daily, so reports would not be reproducible. v1 uses a dated, static table shown in the UI.
- Bulk edits** (e.g. +5% for a country): Risky; comes after salary history is done and tested in v1.
- Multiple organisations: The software is specific to ACME.

## Quality requirements

- Correctness first: The server validates everything. Amounts are whole numbers (no floating-point money). Currency comes from the country, never typed in.
- Security: The password is hashed and supplied through configuration, never hard-coded in production; every API route checks for a signed-in session on the server, not only in the UI; salary history is append-only.
- Performance: Directory and insights respond in under 200 ms with 10,000 employees (indexes, server-side paging).
- Tests: Core logic, authentication and the API covered by fast, deterministic tests that run in seconds.
- Simple to run: One command each to install, seed and start; deployable as one service.

## Assumptions

- "Salary" means **total gross annual fixed pay: The sum of its components, in the employee's local currency.
- Each employee works in one country; their currency is that country's currency.
- Email uniquely identifies an employee.
