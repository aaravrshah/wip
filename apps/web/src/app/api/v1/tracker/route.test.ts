// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createService: vi.fn(), deleteTrackerData: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/services/command-service-factory', () => ({
  createTrackerDataServiceForRequest: mocks.createService,
}));

import { AuthenticationRequiredError } from '@/auth/server';
import { TRACKER_DELETION_PHRASE } from '@wip/schemas';

import { DELETE } from './route';

function request(confirmation: string) {
  return new Request('https://wip.example/api/v1/tracker', {
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
      origin: 'https://wip.example',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify({ confirmation }),
  });
}

describe('DELETE /api/v1/tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createService.mockResolvedValue({ deleteTrackerData: mocks.deleteTrackerData });
  });

  test('rejects an inexact deletion confirmation before calling the service', async () => {
    const response = await DELETE(request('delete it'));

    expect(response.status).toBe(400);
    expect(mocks.deleteTrackerData).not.toHaveBeenCalled();
  });

  test('returns the stable 401 contract when no verified session exists', async () => {
    mocks.createService.mockRejectedValue(new AuthenticationRequiredError());
    const response = await DELETE(request(TRACKER_DELETION_PHRASE));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'authentication_required' },
    });
  });
});
