import type { Db } from './db.js';

export interface UserAccount {
  id: number;
  email: string;
  passwordHash: string;
}

/** The email comparison is case-insensitive (citext). */
export async function findUserByEmail(db: Db, email: string): Promise<UserAccount | null> {
  return db.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });
}

/** Creates or replaces the single HR Manager account (id 1). Used by the seed script. */
export async function setHrManagerAccount(
  db: Db,
  email: string,
  passwordHash: string,
): Promise<void> {
  await db.user.upsert({
    where: { id: 1 },
    create: { id: 1, email, passwordHash },
    update: { email, passwordHash },
  });
}
