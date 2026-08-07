// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  createService: vi.fn(),
  getOrigins: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/env/server', () => ({ getExtensionOrigins: mocks.getOrigins }));
vi.mock('@/services/command-service-factory', () => ({
  createExtensionCaptureServiceForRequest: mocks.createService,
}));

import { AuthenticationRequiredError } from '@/auth/server';

import { OPTIONS, POST } from './route';

const origin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const command = {
  company: 'Fictional Orbit Works',
  role: 'Junior Systems Analyst',
  stage: 'saved',
  sourceUrl: 'https://jobs.example.invalid/roles/123',
  workplace: 'unspecified',
  descriptionHtml: '<p>Build fictional systems.</p>',
  descriptionText: 'Build fictional systems.',
  extraction: {
    extractorVersion: 'wip-extractor/1.0.0',
    selectedSource: 'json_ld',
    fieldEvidence: { description: { source: 'json_ld', confidence: 'high' } },
    warnings: [],
  },
};

function request(requestOrigin = origin, authorization = 'Bearer fictional-session-token') {
  return new Request('http://localhost:3000/api/v1/captures', {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json',
      'idempotency-key': 'extension-capture:123456789',
      origin: requestOrigin,
    },
    body: JSON.stringify(command),
  });
}

describe('/api/v1/captures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrigins.mockReturnValue([origin]);
    mocks.createService.mockResolvedValue({ capture: mocks.capture });
    mocks.capture.mockResolvedValue({
      status: 'created',
      application: {
        id: 'fictional-capture',
        company: command.company,
        role: command.role,
        stage: 'saved',
        path: '/applications/fictional-capture',
      },
      idempotentReplay: false,
    });
  });

  test('allows only configured extension origins and reflects no wildcard CORS header', async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.createService).toHaveBeenCalledWith(origin);
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    expect(response.headers.get('access-control-allow-origin')).not.toBe('*');

    const denied = await POST(request('chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'));
    expect(denied.status).toBe(403);
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    expect(mocks.createService).toHaveBeenCalledTimes(1);
  });

  test('supports bounded Bearer-token preflight and rejects missing authentication', async () => {
    const preflight = OPTIONS(
      new Request('http://localhost:3000/api/v1/captures', {
        method: 'OPTIONS',
        headers: { origin },
      }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-headers')).toContain('Authorization');

    const anonymous = await POST(request(origin, ''));
    expect(anonymous.status).toBe(401);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  test('returns a safe 401 when Clerk cannot verify the supplied session token', async () => {
    mocks.createService.mockRejectedValue(new AuthenticationRequiredError());
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'authentication_required',
        message: 'A verified Clerk session is required.',
      },
    });
  });

  test('returns a stable typed duplicate without invoking an overwrite path', async () => {
    mocks.capture.mockResolvedValue({
      status: 'duplicate',
      application: {
        id: 'existing-fictional-capture',
        company: command.company,
        role: command.role,
        stage: 'saved',
        path: '/applications/existing-fictional-capture',
      },
      matchedOn: ['source_url'],
    });

    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { status: 'duplicate', matchedOn: ['source_url'] },
    });
  });

  test('rejects oversized capture bodies before creating a service', async () => {
    const oversized = request();
    oversized.headers.set('content-length', '512001');
    const response = await POST(oversized);
    expect(response.status).toBe(413);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  test('rejects non-JSON capture requests', async () => {
    const nonJson = request();
    nonJson.headers.set('content-type', 'text/plain');
    const response = await POST(nonJson);

    expect(response.status).toBe(415);
    expect(mocks.createService).not.toHaveBeenCalled();
  });
});
