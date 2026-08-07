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

  test('requires the Clerk authorized-party claim to match the invoking extension', async () => {
    const extensionOrigin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    await expect(
      resolveAuthenticatedDatabaseIdentity(
        {
          isAuthenticated: true,
          userId: 'user_test_a',
          sessionClaims: { azp: extensionOrigin },
        },
        {
          authorizedParties: ['https://wip.example', extensionOrigin],
          requiredAuthorizedParty: extensionOrigin,
        },
      ),
    ).resolves.toEqual({ clerkUserId: 'user_test_a' });

    await expect(
      resolveAuthenticatedDatabaseIdentity(
        {
          isAuthenticated: true,
          userId: 'user_test_a',
          sessionClaims: { azp: 'chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        },
        {
          authorizedParties: ['https://wip.example', extensionOrigin],
          requiredAuthorizedParty: extensionOrigin,
        },
      ),
    ).rejects.toThrow(/authorized Wip origin/i);
    await expect(
      resolveAuthenticatedDatabaseIdentity(
        { isAuthenticated: true, userId: 'user_test_a', sessionClaims: {} },
        {
          authorizedParties: ['https://wip.example', extensionOrigin],
          requiredAuthorizedParty: extensionOrigin,
        },
      ),
    ).rejects.toThrow(/authorized Wip origin/i);
  });
});
