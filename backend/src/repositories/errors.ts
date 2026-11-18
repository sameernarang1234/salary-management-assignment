import { Prisma } from '../generated/prisma/client.js';

/** Another employee already has this email (emails are compared case-insensitively). */
export class EmailInUseError extends Error {
  constructor(readonly email: string) {
    super(`Email already in use: ${email}`);
    this.name = 'EmailInUseError';
  }
}

/** True for a Prisma error with the given code, e.g. P2002 (unique) or P2025 (not found). */
export function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
