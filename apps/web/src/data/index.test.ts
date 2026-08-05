import { beforeEach, describe, expect, test, vi } from 'vitest';

const { createAuthenticatedRepository, requireIdentity } = vi.hoisted(() => ({
  requireIdentity: vi.fn(),
  createAuthenticatedRepository: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/env/server', () => ({
  getServerEnvironment: () => ({
    dataSource: 'neon',
    authenticatedDatabaseUrl:
      'postgresql://authenticated@example-pooler.invalid/wip?sslmode=require',
    clerkJwtTemplate: 'neon',
  }),
}));
vi.mock('@/auth/server', () => ({
  requireAuthenticatedDatabaseIdentity: requireIdentity,
}));
vi.mock('./neon-application-repository', () => ({
  createAuthenticatedNeonApplicationRepository: createAuthenticatedRepository,
}));

import { applicationRepository } from './index';

describe('authenticated repository selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fails closed before database access when the protected session is unavailable', async () => {
    requireIdentity.mockRejectedValue(new Error('A verified Clerk session is required.'));

    await expect(applicationRepository.listApplications()).rejects.toThrow(/verified Clerk/i);
    expect(createAuthenticatedRepository).not.toHaveBeenCalled();
  });

  test('passes only the server-issued database token, never a caller owner id', async () => {
    requireIdentity.mockResolvedValue({
      clerkUserId: 'user_test_a',
      databaseToken: 'signed.jwt.value',
    });
    createAuthenticatedRepository.mockResolvedValue({
      listApplications: vi.fn().mockResolvedValue([]),
      getApplicationById: vi.fn(),
      getReferenceDate: vi.fn(),
    });

    await expect(applicationRepository.listApplications()).resolves.toEqual([]);
    expect(createAuthenticatedRepository).toHaveBeenCalledWith({
      authenticatedDatabaseUrl:
        'postgresql://authenticated@example-pooler.invalid/wip?sslmode=require',
      databaseToken: 'signed.jwt.value',
    });
  });
});
