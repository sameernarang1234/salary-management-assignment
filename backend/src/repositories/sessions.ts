import type { Db } from './db.js';

export async function createSession(
  db: Db,
  session: { tokenHash: string; userId: number; expiresAt: Date },
): Promise<void> {
  await db.session.create({ data: session });
}

/** The user of a session that has not expired at `now`, or null. */
export async function findSessionUser(
  db: Db,
  tokenHash: string,
  now: Date,
): Promise<{ email: string } | null> {
  const session = await db.session.findFirst({
    where: { tokenHash, expiresAt: { gt: now } },
    select: { user: { select: { email: true } } },
  });
  return session ? { email: session.user.email } : null;
}

export async function deleteSession(db: Db, tokenHash: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash } });
}

export async function deleteExpiredSessions(db: Db, now: Date): Promise<void> {
  await db.session.deleteMany({ where: { expiresAt: { lte: now } } });
}
