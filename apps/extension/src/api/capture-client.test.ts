import { afterEach, describe, expect, test, vi } from 'vitest';

import { attachCaptureSnapshot, CaptureApiError, saveCapture } from './capture-client';

const command = {
  company: 'Fictional Orbit Works',
  role: 'Junior Systems Analyst',
  stage: 'saved' as const,
  sourceUrl: 'https://jobs.example.invalid/fictional-role',
  pageTitle: undefined,
  location: undefined,
  workplace: 'remote' as const,
  employmentType: undefined,
  salaryText: undefined,
  requisitionId: undefined,
  descriptionHtml: '<section><p>Build fictional systems for an early-career team.</p></section>',
  descriptionText: 'Build fictional systems for an early-career team.',
  extraction: {
    extractorVersion: 'wip-extractor/1.1.0',
    selectedSource: 'ats_adapter' as const,
    fieldEvidence: {
      description: { source: 'ats_adapter' as const, confidence: 'high' as const },
    },
    warnings: [],
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('extension capture API client', () => {
  test('maps any 401 to a recoverable authentication error without losing context', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: 'internal_auth_error', message: 'Untrusted server detail' } },
            { status: 401 },
          ),
        ),
    );

    const result = saveCapture({
      apiOrigin: 'https://wip.example.invalid',
      command,
      idempotencyKey: 'extension-capture:fictional-auth-test',
      token: 'fictional-expired-token',
    });
    await expect(result).rejects.toMatchObject({
      code: 'authentication_required',
      message: expect.stringMatching(/still here/i),
    });
    await expect(result).rejects.toBeInstanceOf(CaptureApiError);
  });

  test('uses the narrow snapshot attachment endpoint and validates its response', async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json(
        {
          data: {
            status: 'snapshot_attached',
            application: {
              id: 'fictional-application',
              company: command.company,
              role: command.role,
              stage: 'saved',
              path: '/applications/fictional-application',
            },
            snapshot: {
              id: '00000000-0000-4000-8000-000000000123',
              contentSha256: 'a'.repeat(64),
              capturedAt: '2026-08-06T12:00:00.000Z',
            },
            created: true,
            idempotentReplay: false,
          },
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetch);

    await expect(
      attachCaptureSnapshot({
        apiOrigin: 'https://wip.example.invalid',
        command: { ...command, applicationId: 'fictional-application' },
        idempotencyKey: 'extension-snapshot:fictional-attachment',
        token: 'fictional-session-token',
      }),
    ).resolves.toMatchObject({ status: 'snapshot_attached', created: true });
    expect(fetch).toHaveBeenCalledWith(
      'https://wip.example.invalid/api/v1/captures/snapshots',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
