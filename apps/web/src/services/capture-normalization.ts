import 'server-only';

import { createHash } from 'node:crypto';

import type { ExtensionCaptureCommand } from '@wip/schemas';
import sanitizeHtml from 'sanitize-html';

const TRACKING_PARAMETERS = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'source']);

const SAFE_SEMANTIC_TAGS = [
  'p',
  'br',
  'div',
  'section',
  'article',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'blockquote',
  'pre',
  'code',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
] as const;

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/[ \u00a0]+\n/g, '\n')
    .replace(/\n[ \u00a0]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeCaptureUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP(S) capture URLs are supported.');
  }
  url.username = '';
  url.password = '';
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMETERS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function equivalentHosts(left: URL, right: URL): boolean {
  const normalizeHost = (host: string) => host.toLowerCase().replace(/^www\./, '');
  return normalizeHost(left.hostname) === normalizeHost(right.hostname);
}

export interface PreparedExtensionSnapshot {
  sourceUrl: string;
  canonicalUrl?: string;
  pageTitle?: string;
  html: string;
  text: string;
  contentSha256: string;
  extractorVersion: string;
  provenance: string;
  metadata: Record<string, unknown>;
}

export interface PreparedExtensionCapture {
  applicationSourceUrl: string;
  snapshot: PreparedExtensionSnapshot;
}

export function prepareExtensionCapture(
  command: ExtensionCaptureCommand,
): PreparedExtensionCapture {
  const sourceUrl = normalizeCaptureUrl(command.sourceUrl);
  const normalizedCanonical = command.canonicalUrl
    ? normalizeCaptureUrl(command.canonicalUrl)
    : undefined;
  const canonicalUrl =
    normalizedCanonical && equivalentHosts(new URL(sourceUrl), new URL(normalizedCanonical))
      ? normalizedCanonical
      : undefined;
  const text = normalizeText(command.descriptionText);
  if (!text) throw new Error('The captured job description is empty after normalization.');

  let html = sanitizeHtml(command.descriptionHtml, {
    allowedTags: [...SAFE_SEMANTIC_TAGS],
    allowedAttributes: {},
    allowedSchemes: [],
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
  }).trim();
  if (!html) {
    html = sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} })
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
      .join('');
  }

  return {
    applicationSourceUrl: canonicalUrl ?? sourceUrl,
    snapshot: {
      sourceUrl,
      ...(canonicalUrl ? { canonicalUrl } : {}),
      ...(command.pageTitle ? { pageTitle: command.pageTitle } : {}),
      html,
      text,
      contentSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
      extractorVersion: command.extraction.extractorVersion,
      provenance: `User-confirmed extension capture (${command.extraction.selectedSource})`,
      metadata: {
        schemaVersion: 1,
        selectedSource: command.extraction.selectedSource,
        fieldEvidence: command.extraction.fieldEvidence,
        warnings: command.extraction.warnings,
        ...(command.employmentType ? { employmentType: command.employmentType } : {}),
        ...(command.salaryText ? { salaryText: command.salaryText } : {}),
      },
    },
  };
}
