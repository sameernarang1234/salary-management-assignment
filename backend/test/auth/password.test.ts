import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/password.js';

describe('password hashing', () => {
  it('stores the algorithm, its parameters, a salt and the hash, never the password', async () => {
    const stored = await hashPassword('correct horse battery staple');

    expect(stored).toMatch(/^scrypt\$32768\$8\$1\$[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*$/);
    expect(stored).not.toContain('correct horse');
  });

  it('uses a new salt every time', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });

  it('accepts the right password', async () => {
    const stored = await hashPassword('s3cret-Passw0rd');

    expect(await verifyPassword('s3cret-Passw0rd', stored)).toBe(true);
  });

  it.each(['s3cret-passw0rd', 's3cret-Passw0rd ', '', 'something else'])(
    'rejects the wrong password "%s"',
    async (attempt) => {
      const stored = await hashPassword('s3cret-Passw0rd');

      expect(await verifyPassword(attempt, stored)).toBe(false);
    },
  );

  it.each(['', 'plain-text', 'bcrypt$10$abc$def', 'scrypt$32768$8$1$c2FsdA==', 'scrypt$x$8$1$a$b'])(
    'rejects a malformed stored hash "%s" instead of throwing',
    async (stored) => {
      expect(await verifyPassword('anything', stored)).toBe(false);
    },
  );
});
