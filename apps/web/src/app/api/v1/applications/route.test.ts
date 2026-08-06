// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createService: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/data', () => ({ createApplicationRepositoryForApiRequest: vi.fn() }));
vi.mock('@/services/command-service-factory', () => ({
  createApplicationCommandServiceForRequest: mocks.createService,
}));

import { AuthenticationRequiredError } from '@/auth/server';

import { POST } from './route';

describe('POST /api/v1/applications', () => {
  beforeEach(() => vi.clearAllMocks());

  test('returns the stable 401 contract when no verified Clerk session exists', async () => {
    mocks.createService.mockRejectedValue(new AuthenticationRequiredError());
    const response = await POST(
      new Request('https://wip.example/api/v1/applications', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'application-create:test-key-1234',
          origin: 'https://wip.example',
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          company: 'Fictional Lumen Works',
          role: 'Associate Researcher',
          stage: 'saved',
          workplace: 'unspecified',
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'authentication_required',
        message: 'A verified Clerk session is required.',
      },
    });
  });
});
