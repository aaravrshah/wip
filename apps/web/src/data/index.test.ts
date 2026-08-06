import { beforeEach, describe, expect, test, vi } from 'vitest';

const { createAuthenticatedRepository, requireIdentity } = vi.hoisted(() => ({
  requireIdentity: vi.fn(),
  createAuthenticatedRepository: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/env/server', () => ({
  getServerEnvironment: () => ({
    dataSource: 'neon',
    runtimeDatabaseUrl: `postgresql://wip_runtime:${'a'.repeat(64)}@example-pooler.invalid/wip?sslmode=require`,
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

  test('passes only the server-verified Clerk subject, never a caller owner id', async () => {
    requireIdentity.mockResolvedValue({
      clerkUserId: 'user_test_a',
    });
    createAuthenticatedRepository.mockResolvedValue({
      listApplications: vi.fn().mockResolvedValue([]),
      getApplicationById: vi.fn(),
      getReferenceDate: vi.fn(),
    });

    await expect(applicationRepository.listApplications()).resolves.toEqual([]);
    expect(createAuthenticatedRepository).toHaveBeenCalledWith({
      runtimeDatabaseUrl: `postgresql://wip_runtime:${'a'.repeat(64)}@example-pooler.invalid/wip?sslmode=require`,
      clerkUserId: 'user_test_a',
    });
  });
});
