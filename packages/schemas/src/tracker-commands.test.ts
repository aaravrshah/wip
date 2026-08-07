import { describe, expect, test } from 'vitest';

import {
  createApplicationContactCommandSchema,
  createApplicationCommandSchema,
  createApplicationDocumentCommandSchema,
  createNoteCommandSchema,
  deleteTrackerDataCommandSchema,
  extensionCaptureCommandSchema,
  extensionCaptureResponseSchema,
  extensionSnapshotAttachmentCommandSchema,
  extensionSnapshotAttachmentResponseSchema,
  idempotencyKeySchema,
  TRACKER_DELETION_PHRASE,
} from './tracker-commands';

describe('tracker command schemas', () => {
  test('normalizes optional application facts while preserving the canonical stage vocabulary', () => {
    expect(
      createApplicationCommandSchema.parse({
        company: '  Fictional Fern Labs  ',
        role: '  Junior Analyst ',
        stage: 'assessment',
        sourceName: '   ',
      }),
    ).toMatchObject({
      company: 'Fictional Fern Labs',
      role: 'Junior Analyst',
      stage: 'assessment',
      workplace: 'unspecified',
      sourceName: undefined,
    });
  });

  test('rejects oversized free text before persistence', () => {
    expect(() => createNoteCommandSchema.parse({ body: 'x'.repeat(10_001) })).toThrow();
    expect(() =>
      createApplicationCommandSchema.parse({
        company: 'Fictional Company',
        role: 'Role',
        jobDescriptionText: 'x'.repeat(200_001),
      }),
    ).toThrow();
  });

  test('requires bounded opaque idempotency keys', () => {
    expect(idempotencyKeySchema.parse('create:12345678-abcd')).toBe('create:12345678-abcd');
    expect(() => idempotencyKeySchema.parse('short')).toThrow();
  });

  test('rejects caller-supplied ownership or trusted identity fields', () => {
    expect(() =>
      createApplicationCommandSchema.parse({
        company: 'Fictional Company',
        role: 'Junior Analyst',
        ownerId: '00000000-0000-4000-8000-000000000001',
        clerkSubject: 'forged_subject',
      }),
    ).toThrow();
  });

  test('accepts only web source URLs', () => {
    expect(() =>
      createApplicationCommandSchema.parse({
        company: 'Fictional Company',
        role: 'Junior Analyst',
        sourceUrl: 'javascript:alert(1)',
      }),
    ).toThrow(/http/i);
  });

  test('validates contact and metadata-only document commands without trusting owners', () => {
    expect(
      createApplicationContactCommandSchema.parse({
        mode: 'create',
        name: '  Fictional Casey  ',
        relationship: 'recruiter',
        email: 'casey@example.invalid',
      }),
    ).toMatchObject({ name: 'Fictional Casey', relationship: 'recruiter' });
    expect(() =>
      createApplicationContactCommandSchema.parse({
        mode: 'create',
        name: 'Fictional Casey',
        relationship: 'recruiter',
        ownerId: '00000000-0000-4000-8000-000000000001',
      }),
    ).toThrow();
    expect(() =>
      createApplicationDocumentCommandSchema.parse({
        mode: 'create',
        kind: 'resume',
        title: 'Product resume',
        versionLabel: 'v1',
        contentSha256: 'ABC',
        purpose: 'submitted',
      }),
    ).toThrow(/SHA-256/i);
  });

  test('requires the exact tracker deletion phrase', () => {
    expect(deleteTrackerDataCommandSchema.parse({ confirmation: TRACKER_DELETION_PHRASE })).toEqual(
      { confirmation: TRACKER_DELETION_PHRASE },
    );
    expect(() =>
      deleteTrackerDataCommandSchema.parse({ confirmation: 'delete my wip data' }),
    ).toThrow();
  });

  test('validates a bounded extension capture without accepting ownership', () => {
    const capture = extensionCaptureCommandSchema.parse({
      company: '  Fictional Orbit Works ',
      role: ' Junior Systems Analyst ',
      sourceUrl: 'https://jobs.example.invalid/roles/123',
      canonicalUrl: 'https://jobs.example.invalid/roles/123',
      descriptionHtml: '<p>Build fictional systems.</p>',
      descriptionText: 'Build fictional systems.',
      extraction: {
        extractorVersion: 'wip-extractor/1.0.0',
        selectedSource: 'json_ld',
        fieldEvidence: {
          company: { source: 'json_ld', confidence: 'high' },
          role: { source: 'json_ld', confidence: 'high' },
          description: { source: 'json_ld', confidence: 'high' },
        },
        warnings: [],
      },
    });

    expect(capture).toMatchObject({
      company: 'Fictional Orbit Works',
      role: 'Junior Systems Analyst',
      stage: 'saved',
    });
    expect(() =>
      extensionCaptureCommandSchema.parse({ ...capture, ownerId: crypto.randomUUID() }),
    ).toThrow();
    expect(() =>
      extensionCaptureCommandSchema.parse({ ...capture, descriptionHtml: 'x'.repeat(250_001) }),
    ).toThrow();
  });

  test('keeps extension capture responses typed as created or duplicate', () => {
    expect(
      extensionCaptureResponseSchema.parse({
        status: 'duplicate',
        application: {
          id: 'fictional-application',
          company: 'Fictional Orbit Works',
          role: 'Junior Systems Analyst',
          stage: 'saved',
          path: '/applications/fictional-application',
        },
        matchedOn: ['source_url'],
      }).status,
    ).toBe('duplicate');
  });

  test('requires an explicit application target for immutable snapshot attachment', () => {
    const command = extensionSnapshotAttachmentCommandSchema.parse({
      applicationId: 'fictional-application',
      company: 'Fictional Orbit Works',
      role: 'Junior Systems Analyst',
      sourceUrl: 'https://jobs.example.invalid/roles/123',
      descriptionHtml: '<p>Updated fictional description.</p>',
      descriptionText: 'Updated fictional description.',
      extraction: {
        extractorVersion: 'wip-extractor/1.1.0',
        selectedSource: 'ats_adapter',
        fieldEvidence: {
          description: { source: 'ats_adapter', confidence: 'high' },
        },
        warnings: [],
      },
    });
    expect(command.applicationId).toBe('fictional-application');
    expect(() =>
      extensionSnapshotAttachmentCommandSchema.parse({
        ...command,
        applicationId: '../another-owner',
      }),
    ).toThrow();
    expect(
      extensionSnapshotAttachmentResponseSchema.parse({
        status: 'snapshot_attached',
        application: {
          id: 'fictional-application',
          company: command.company,
          role: command.role,
          stage: 'saved',
          path: '/applications/fictional-application',
        },
        snapshot: {
          id: crypto.randomUUID(),
          contentSha256: 'a'.repeat(64),
          capturedAt: '2026-08-06T12:00:00.000Z',
        },
        created: true,
        idempotentReplay: false,
      }).status,
    ).toBe('snapshot_attached');
  });
});
