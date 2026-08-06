import { describe, expect, test, vi } from 'vitest';
import { z } from 'zod';

vi.mock('server-only', () => ({}));

import {
  apiError,
  assertExtensionOrigin,
  assertSameOrigin,
  parseApplicationId,
  parseResourceUuid,
  readJson,
  requireBearerAuthorization,
} from './route-utils';

describe('API request boundary', () => {
  test('accepts same-origin JSON and rejects cross-site cookie-authenticated writes', () => {
    expect(() =>
      assertSameOrigin(
        new Request('https://wip.example/api/v1/applications', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'https://wip.example',
            'sec-fetch-site': 'same-origin',
          },
        }),
      ),
    ).not.toThrow();

    const request = new Request('https://wip.example/api/v1/applications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://attacker.example',
        'sec-fetch-site': 'cross-site',
      },
    });
    expect(() => assertSameOrigin(request)).toThrow(/cross-origin/i);
  });

  test('rejects unsupported content types and oversized streamed bodies', async () => {
    expect(() =>
      assertSameOrigin(
        new Request('https://wip.example/api/v1/applications', {
          method: 'POST',
          headers: { origin: 'https://wip.example', 'content-type': 'text/plain' },
        }),
      ),
    ).toThrow(/application\/json/i);

    const response = apiError(
      await readJson(
        new Request('https://wip.example/api/v1/applications', {
          method: 'POST',
          body: JSON.stringify({ value: 'x'.repeat(256_001) }),
        }),
        z.object({ value: z.string() }),
      ).catch((error: unknown) => error),
    );
    expect(response.status).toBe(413);
  });

  test('validates path identifiers before they reach PostgreSQL', () => {
    expect(parseApplicationId('fictional-application_1')).toBe('fictional-application_1');
    expect(() => parseApplicationId('../another-owner')).toThrow(/invalid/i);
    expect(() => parseResourceUuid('not-a-uuid', 'noteId')).toThrow(/invalid/i);
    expect(parseResourceUuid('00000000-0000-4000-8000-000000000001', 'actionId')).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
  });

  test('requires an exact extension origin and explicit Bearer token', () => {
    const extensionOrigin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const request = new Request('https://wip.example/api/v1/captures', {
      headers: { authorization: 'Bearer fictional-token', origin: extensionOrigin },
    });
    expect(assertExtensionOrigin(request, [extensionOrigin])).toBe(extensionOrigin);
    expect(() => requireBearerAuthorization(request)).not.toThrow();
    expect(() =>
      assertExtensionOrigin(request, ['chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']),
    ).toThrow(/not allowed/i);
    expect(() =>
      requireBearerAuthorization(new Request('https://wip.example/api/v1/captures')),
    ).toThrow(/Bearer/i);
  });
});
