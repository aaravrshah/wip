import { describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { AuthenticationRequiredError, resolveAuthenticatedDatabaseIdentity } from './server';

describe('authenticated database identity', () => {
  test('rejects a missing or unauthenticated Clerk session', async () => {
    await expect(
      resolveAuthenticatedDatabaseIdentity({ isAuthenticated: false, userId: null }),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  test('returns only the verified Clerk subject', async () => {
    await expect(
      resolveAuthenticatedDatabaseIdentity({ isAuthenticated: true, userId: 'user_test_a' }),
    ).resolves.toEqual({ clerkUserId: 'user_test_a' });
  });
});
