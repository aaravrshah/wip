import { describe, expect, test } from 'vitest';

import { normalizeSha256 } from './seed';

describe('database seed normalization', () => {
  const digest = '71be699f442124ab999226486ce67b3f788bb04186a1082b7a79f4582c22f1df';

  test('removes the fixture display prefix before inserting a PostgreSQL digest', () => {
    expect(normalizeSha256(`sha256:${digest}`)).toBe(digest);
  });

  test('accepts an already normalized digest', () => {
    expect(normalizeSha256(digest)).toBe(digest);
  });

  test('rejects malformed digests before sending a database query', () => {
    expect(() => normalizeSha256('sha256:not-a-digest')).toThrow(/64 lowercase hexadecimal/i);
  });
});
