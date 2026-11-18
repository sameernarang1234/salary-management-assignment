-- Case-insensitive text for emails (added by hand; Prisma does not create extensions).
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "employee_status" AS ENUM ('active', 'left');

-- CreateEnum
CREATE TYPE "salary_change_reason" AS ENUM ('new_hire', 'annual_increment', 'promotion', 'correction', 'other');

-- CreateTable
CREATE TABLE "countries" (
    "code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "usd_per_unit" DECIMAL(18,8) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "component_types" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "component_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "hire_date" DATE NOT NULL,
    "status" "employee_status" NOT NULL DEFAULT 'active',
    "left_on" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_components" (
    "employee_id" INTEGER NOT NULL,
    "component_code" TEXT NOT NULL,
    "annual_amount" INTEGER NOT NULL,

    CONSTRAINT "salary_components_pkey" PRIMARY KEY ("employee_id","component_code")
);

-- CreateTable
CREATE TABLE "salary_history" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "effective_date" DATE NOT NULL,
    "reason" "salary_change_reason" NOT NULL,
    "previous_components" JSONB,
    "new_components" JSONB NOT NULL,
    "previous_total" INTEGER,
    "new_total" INTEGER NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "token_hash" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("token_hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_status_country_code_job_title_idx" ON "employees"("status", "country_code", "job_title");

-- CreateIndex
CREATE INDEX "employees_department_idx" ON "employees"("department");

-- CreateIndex
CREATE INDEX "employees_full_name_idx" ON "employees"("full_name");

-- CreateIndex
CREATE INDEX "salary_history_employee_id_effective_date_idx" ON "salary_history"("employee_id", "effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_component_code_fkey" FOREIGN KEY ("component_code") REFERENCES "component_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_history" ADD CONSTRAINT "salary_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Added by hand: rules Prisma's schema language can't express.
-- ============================================================================

-- One component's annual amount: whole local units, 1 to 100,000,000
-- (same limit as MAX_COMPONENT_AMOUNT in src/validators/salaryComponents.ts).
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_annual_amount_range"
    CHECK ("annual_amount" BETWEEN 1 AND 100000000);

-- Exactly one account: the HR Manager.
ALTER TABLE "users" ADD CONSTRAINT "users_single_account" CHECK ("id" = 1);

-- left_on is set if and only if the employee has left.
ALTER TABLE "employees" ADD CONSTRAINT "employees_left_on_matches_status"
    CHECK (("status" = 'left') = ("left_on" IS NOT NULL));

-- Previous components and total are absent only for the first entry (new_hire).
ALTER TABLE "salary_history" ADD CONSTRAINT "salary_history_previous_matches_reason"
    CHECK (
        ("reason" = 'new_hire' AND "previous_components" IS NULL AND "previous_total" IS NULL)
        OR ("reason" <> 'new_hire' AND "previous_components" IS NOT NULL AND "previous_total" IS NOT NULL)
    );

-- Salary history is append-only: any UPDATE or DELETE raises an error.
-- (TRUNCATE skips row triggers; the application never truncates, and the test helper relies on it.)
CREATE FUNCTION "reject_salary_history_change"() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'salary_history is append-only: % is not allowed', TG_OP
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "salary_history_append_only"
    BEFORE UPDATE OR DELETE ON "salary_history"
    FOR EACH ROW EXECUTE FUNCTION "reject_salary_history_change"();

-- The fixed salary component catalogue
-- (same as SALARY_COMPONENT_CATALOGUE in src/validators/salaryComponents.ts).
INSERT INTO "component_types" ("code", "name", "is_required") VALUES
    ('BASIC', 'Basic', true),
    ('HRA', 'House Rent Allowance', false),
    ('HOUSING', 'Housing Allowance', false),
    ('TRANSPORT', 'Transport Allowance', false),
    ('SPECIAL', 'Special Allowance', false);
