import type { z } from 'zod';

/** Errors a service can raise on purpose. The HTTP layer maps each `code` to a status. */
export abstract class ServiceError extends Error {
  abstract readonly code: string;
}

/** Input failed validation; `fields` maps a field path (e.g. "components.0.annualAmount") to a message. */
export class ValidationError extends ServiceError {
  readonly code = 'VALIDATION_FAILED';

  constructor(readonly fields: Record<string, string>) {
    super('Validation failed');
    this.name = 'ValidationError';
  }

  /** Keeps the first message per field; an error about the whole input is reported as "body". */
  static fromZod(error: z.ZodError): ValidationError {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.length > 0 ? issue.path.map(String).join('.') : 'body';
      fields[key] ??= issue.message;
    }
    return new ValidationError(fields);
  }
}

export class EmployeeNotFoundError extends ServiceError {
  readonly code = 'EMPLOYEE_NOT_FOUND';

  constructor(readonly employeeId: number) {
    super(`Employee ${employeeId} not found`);
    this.name = 'EmployeeNotFoundError';
  }
}

export class DuplicateEmailError extends ServiceError {
  readonly code = 'EMAIL_IN_USE';
  readonly fields = { email: 'This email is already used by another employee' };

  constructor(readonly email: string) {
    super(`Email already in use: ${email}`);
    this.name = 'DuplicateEmailError';
  }
}

export class EmployeeLeftError extends ServiceError {
  readonly code = 'EMPLOYEE_LEFT';

  constructor(readonly employeeId: number) {
    super(`Employee ${employeeId} has left`);
    this.name = 'EmployeeLeftError';
  }
}
