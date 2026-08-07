// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  attachSnapshot: vi.fn(),
  createService: vi.fn(),
  getOrigins: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/env/server', () => ({ getExtensionOrigins: mocks.getOrigins }));
vi.mock('@/services/command-service-factory', () => ({
  createExtensionCaptureServiceForRequest: mocks.createService,
}));

import { OPTIONS, POST } from './route';

const origin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const command = {
  applicationId: 'fictional-application',
  company: 'Fictional Orbit Works',
  role: 'Junior Systems Analyst',
  stage: 'saved',
  sourceUrl: 'https://jobs.example.invalid/roles/123',
  workplace: 'unspecified',
  descriptionHtml: '<p>Updated fictional job description.</p>',
  descriptionText: 'Updated fictional job description.',
  extraction: {
    extractorVersion: 'wip-extractor/1.1.0',
    selectedSource: 'ats_adapter',
    fieldEvidence: { description: { source: 'ats_adapter', confidence: 'high' } },
    warnings: [],
  },
};

function request(requestOrigin = origin) {
  return new Request('http://localhost:3000/api/v1/captures/snapshots', {
    method: 'POST',
    headers: {
      authorization: 'Bearer fictional-session-token',
      'content-type': 'application/json',
      'idempotency-key': 'extension-snapshot:123456789',
      origin: requestOrigin,
    },
    body: JSON.stringify(command),
  });
}

describe('/api/v1/captures/snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrigins.mockReturnValue([origin]);
    mocks.createService.mockResolvedValue({ attachSnapshot: mocks.attachSnapshot });
    mocks.attachSnapshot.mockResolvedValue({
      status: 'snapshot_attached',
      application: {
        id: command.applicationId,
        company: command.company,
        role: command.role,
        stage: 'saved',
        path: `/applications/${command.applicationId}`,
      },
      snapshot: {
        id: '00000000-0000-4000-8000-000000000123',
        contentSha256: 'a'.repeat(64),
        capturedAt: '2026-08-06T12:00:00.000Z',
      },
      created: true,
      idempotentReplay: false,
    });
  });

  test('attaches only for an allowlisted extension and passes that party to Clerk verification', async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    expect(mocks.createService).toHaveBeenCalledWith(origin);
    expect(mocks.attachSnapshot).toHaveBeenCalledWith(command, 'extension-snapshot:123456789');

    const denied = await POST(request('chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'));
    expect(denied.status).toBe(403);
    expect(mocks.attachSnapshot).toHaveBeenCalledTimes(1);
  });

  test('supports a bounded preflight and rejects invalid application targets', async () => {
    const preflight = OPTIONS(
      new Request('http://localhost:3000/api/v1/captures/snapshots', {
        method: 'OPTIONS',
        headers: { origin },
      }),
    );
    expect(preflight.status).toBe(204);

    const invalid = request();
    const body = { ...command, applicationId: '../another-owner' };
    const response = await POST(
      new Request(invalid.url, {
        method: 'POST',
        headers: invalid.headers,
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.attachSnapshot).not.toHaveBeenCalled();
  });
});
