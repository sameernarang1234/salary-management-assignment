import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '../../src/services/errors.js';

describe('ValidationError.fromZod', () => {
  it('keeps the first message for each field path', () => {
    const schema = z.object({
      name: z.string().min(1, 'Required').min(3, 'Too short'),
      components: z.array(z.object({ amount: z.number({ error: 'Must be a number' }) })),
    });
    const result = schema.safeParse({ name: '', components: [{ amount: 'x' }] });

    expect(ValidationError.fromZod(result.error!).fields).toEqual({
      name: 'Required',
      'components.0.amount': 'Must be a number',
    });
  });

  it('uses "body" for an error about the whole input', () => {
    const result = z.object({ name: z.string() }).safeParse('not an object');

    expect(Object.keys(ValidationError.fromZod(result.error!).fields)).toEqual(['body']);
  });
});
