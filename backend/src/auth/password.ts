import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/*
 * Passwords are hashed with scrypt (memory-hard, built into Node).
 * Stored format: scrypt$N$r$p$<salt base64>$<hash base64>, so parameters can be raised later
 * without breaking existing hashes.
 */
const COST = 32_768; // N = 2^15
const BLOCK_SIZE = 8; // r
const PARALLELISM = 1; // p
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_COST = 1_048_576; // refuse absurd parameters from a tampered hash
const MAX_MEMORY = 256 * 1024 * 1024;

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, { ...options, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
  });
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

const positiveInteger = (value: string | undefined) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

/** True if `password` matches `stored`. A malformed stored hash returns false. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelism, saltText, hashText, ...rest] = stored.split('$');
  const N = positiveInteger(cost);
  const r = positiveInteger(blockSize);
  const p = positiveInteger(parallelism);
  if (algorithm !== 'scrypt' || rest.length > 0 || !N || !r || !p || N > MAX_COST) {
    return false;
  }
  const salt = Buffer.from(saltText ?? '', 'base64');
  const expected = Buffer.from(hashText ?? '', 'base64');
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }
  try {
    const actual = await deriveKey(password, salt, expected.length, { N, r, p });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
