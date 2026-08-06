import { extensionCaptureCommandSchema } from '@wip/schemas';
import { describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { normalizeCaptureUrl, prepareExtensionCapture } from './capture-normalization';

const baseCapture = extensionCaptureCommandSchema.parse({
  company: 'Fictional Orbit Works',
  role: 'Junior Systems Analyst',
  stage: 'saved' as const,
  sourceUrl: 'https://jobs.example.invalid/roles/123?utm_source=test&job=123#apply',
  canonicalUrl: 'https://www.jobs.example.invalid/roles/123?job=123',
  workplace: 'hybrid' as const,
  descriptionHtml:
    '<section onclick="steal()"><h2>About the role</h2><script>steal()</script><p><img src=x onerror=steal()>Build fictional systems.</p></section>',
  descriptionText: 'About the role\n\nBuild fictional systems.',
  extraction: {
    extractorVersion: 'wip-extractor/1.0.0',
    selectedSource: 'json_ld' as const,
    fieldEvidence: {
      role: { source: 'json_ld' as const, confidence: 'high' as const },
      company: { source: 'json_ld' as const, confidence: 'high' as const },
      description: { source: 'json_ld' as const, confidence: 'high' as const },
    },
    warnings: [],
  },
});

describe('extension capture normalization', () => {
  test('normalizes URLs conservatively without discarding job identifiers', () => {
    expect(normalizeCaptureUrl(baseCapture.sourceUrl)).toBe(
      'https://jobs.example.invalid/roles/123?job=123',
    );
  });

  test('sanitizes hostile HTML and hashes canonical text server-side', () => {
    const prepared = prepareExtensionCapture(baseCapture);

    expect(prepared.applicationSourceUrl).toBe(
      'https://www.jobs.example.invalid/roles/123?job=123',
    );
    expect(prepared.snapshot.html).toContain('<h2>About the role</h2>');
    expect(prepared.snapshot.html).not.toMatch(/script|onclick|onerror|<img/i);
    expect(prepared.snapshot.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(prepared.snapshot.metadata).toMatchObject({
      schemaVersion: 1,
      selectedSource: 'json_ld',
    });
  });

  test('ignores a cross-site canonical URL', () => {
    const prepared = prepareExtensionCapture(
      extensionCaptureCommandSchema.parse({
        ...baseCapture,
        canonicalUrl: 'https://attacker.example.invalid/replace',
      }),
    );
    expect(prepared.applicationSourceUrl).toBe('https://jobs.example.invalid/roles/123?job=123');
    expect(prepared.snapshot.canonicalUrl).toBeUndefined();
  });
});
