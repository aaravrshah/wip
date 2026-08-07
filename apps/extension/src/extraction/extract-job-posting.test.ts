import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { EXTRACTOR_VERSION, extractJobPostingInPage } from './extract-job-posting';

function fixture(name: string): string {
  return readFileSync(resolve(process.cwd(), 'src/extraction/fixtures', `${name}.html`), 'utf8');
}

describe('job-posting extraction', () => {
  test('prefers complete JobPosting JSON-LD with high-confidence provenance', () => {
    const result = extractJobPostingInPage({
      html: fixture('json-ld'),
      url: 'https://jobs.example.invalid/orbit/analyst?utm_source=test',
    });
    expect(result.status).toBe('captured');
    if (result.status !== 'captured') return;
    expect(result.draft).toMatchObject({
      extractorVersion: EXTRACTOR_VERSION,
      selectedSource: 'json_ld',
      company: 'Fictional Orbit Works',
      role: 'Junior Systems Analyst',
      location: 'Port Aurora, NY',
      workplace: 'remote',
      employmentType: 'FULL_TIME',
      requisitionId: 'ORBIT-104',
      salaryText: 'USD 62000–74000 YEAR',
      fieldEvidence: { description: { source: 'json_ld', confidence: 'high' } },
    });
    expect(result.draft.descriptionText).not.toContain('Unrelated navigation');
  });

  test.each([
    ['semantic', 'semantic', 'Fictional Lumen Works'],
    ['greenhouse', 'ats_adapter', 'Fictional Greenhouse Studio'],
    ['lever', 'ats_adapter', 'Fictional Northstar Lab'],
    ['workday', 'ats_adapter', 'Fictional Harbor Research'],
  ])('extracts a focused %s page without live scraping', (name, source, company) => {
    const result = extractJobPostingInPage({
      html: fixture(name),
      url: `https://jobs.example.invalid/${name}`,
    });
    expect(result.status).toBe('captured');
    if (result.status !== 'captured') return;
    expect(result.draft.selectedSource).toBe(source);
    expect(result.draft.company).toBe(company);
  });

  test.each([
    [
      'greenhouse',
      {
        role: 'Product Support Associate',
        location: 'Hybrid — Cedar Falls, IA',
        workplace: 'hybrid',
        employmentType: 'Full-time',
        requisitionId: 'GREEN-27',
      },
    ],
    [
      'lever',
      {
        role: 'Community Operations Coordinator',
        location: 'Remote — United States',
        workplace: 'remote',
        employmentType: 'Full-time',
        requisitionId: 'LEV-208',
      },
    ],
    [
      'workday',
      {
        role: 'Associate Data Steward',
        location: 'Boston, MA',
        workplace: 'hybrid',
        employmentType: 'Full time',
        requisitionId: 'R-1042',
      },
    ],
  ])('extracts reviewed %s ATS fields from fictional fixtures', (name, expected) => {
    const result = extractJobPostingInPage({
      html: fixture(name),
      url: `https://jobs.example.invalid/${name}`,
    });
    expect(result.status).toBe('captured');
    if (result.status !== 'captured') return;
    expect(result.draft).toMatchObject({
      ...expected,
      selectedSource: 'ats_adapter',
      fieldEvidence: { description: { source: 'ats_adapter', confidence: 'high' } },
    });
  });

  test('ignores malformed structured data and explains the fallback', () => {
    const result = extractJobPostingInPage({
      html: fixture('malformed-json-ld'),
      url: 'https://jobs.example.invalid/operations',
    });
    expect(result.status).toBe('captured');
    if (result.status !== 'captured') return;
    expect(result.draft.warnings).toContain(
      'Some structured job data was malformed and was ignored.',
    );
  });

  test('selects the most complete item when JSON-LD contains arrays and graphs', () => {
    const result = extractJobPostingInPage({
      html: fixture('multiple-json-ld'),
      url: 'https://jobs.example.invalid/design-apprentice',
    });
    expect(result.status).toBe('captured');
    if (result.status !== 'captured') return;
    expect(result.draft.role).toBe('Design Apprentice');
    expect(result.draft.warnings).toContain(
      'Multiple job postings were present; Wip selected the most complete one.',
    );
  });

  test('excludes hostile controls, scripts, remote media, and event attributes', () => {
    const result = extractJobPostingInPage({
      html: fixture('hostile'),
      url: 'https://jobs.example.invalid/qa-apprentice',
    });
    expect(result.status).toBe('captured');
    if (result.status !== 'captured') return;
    expect(result.draft.descriptionHtml).not.toMatch(
      /script|style|form|input|iframe|img|onclick|onerror|private-answer|document\.cookie/i,
    );
  });

  test('does not fabricate a job from an irrelevant page', () => {
    expect(
      extractJobPostingInPage({
        html: fixture('irrelevant'),
        url: 'https://news.example.invalid/story',
      }),
    ).toMatchObject({ status: 'unsupported' });
  });

  test('marks broad-region fallback fields as low confidence', () => {
    const result = extractJobPostingInPage({
      html: '<main><h1>Fictional Support Associate</h1><h2>Responsibilities</h2><p>Help customers and document recurring issues.</p><h2>Qualifications</h2><p>Clear written communication.</p></main>',
      url: 'https://jobs.example.invalid/support-associate',
    });
    expect(result.status).toBe('captured');
    if (result.status !== 'captured') return;
    expect(result.draft.fieldEvidence.role).toEqual({
      source: 'heuristic',
      confidence: 'low',
    });
  });

  test('rejects oversized detected content instead of truncating silently', () => {
    const html = `<main><h1>Fictional Role</h1><article data-job-description><h2>Responsibilities</h2><p>${'x'.repeat(200_001)}</p></article></main>`;
    expect(
      extractJobPostingInPage({ html, url: 'https://jobs.example.invalid/too-large' }),
    ).toMatchObject({ status: 'unsupported', reason: expect.stringMatching(/too large/i) });
  });
});
