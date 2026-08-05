import { describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { AuthenticationRequiredError, resolveAuthenticatedDatabaseIdentity } from './server';

describe('authenticated database identity', () => {
  test('rejects a missing or unauthenticated Clerk session', async () => {
    await expect(
      resolveAuthenticatedDatabaseIdentity(
        { isAuthenticated: false, userId: null, getToken: vi.fn() },
        'neon',
      ),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  test('rejects a session when Clerk cannot issue the configured JWT', async () => {
    await expect(
      resolveAuthenticatedDatabaseIdentity(
        { isAuthenticated: true, userId: 'user_test_a', getToken: vi.fn().mockResolvedValue(null) },
        'neon',
      ),
    ).rejects.toThrow(/did not issue/i);
  });

  test('returns only the verified Clerk subject and Clerk-issued token', async () => {
    const getToken = vi.fn().mockResolvedValue('signed.jwt.value');

    await expect(
      resolveAuthenticatedDatabaseIdentity(
        { isAuthenticated: true, userId: 'user_test_a', getToken },
        'wip-neon',
      ),
    ).resolves.toEqual({ clerkUserId: 'user_test_a', databaseToken: 'signed.jwt.value' });
    expect(getToken).toHaveBeenCalledWith({ template: 'wip-neon' });
  });
});
