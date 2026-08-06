import { createHash } from 'node:crypto';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export interface NormalizedManualSnapshot {
  text: string;
  html: string;
  contentSha256: string;
  extractorVersion: 'manual-paste-v1';
  provenance: 'User-pasted job description';
}

export function normalizeManualJobDescription(value: string): NormalizedManualSnapshot {
  const text = value
    .normalize('NFKC')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) throw new TrackerErrorForSnapshot('The pasted job description is empty.');

  const html = text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`)
    .join('');

  return {
    text,
    html,
    contentSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
    extractorVersion: 'manual-paste-v1',
    provenance: 'User-pasted job description',
  };
}

export class TrackerErrorForSnapshot extends Error {}
