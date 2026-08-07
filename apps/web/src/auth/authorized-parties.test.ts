import { describe, expect, test } from 'vitest';

import { configuredAuthorizedParties } from './authorized-parties';

describe('Clerk authorized-party configuration', () => {
  test('accepts only exact web and extension origins', () => {
    expect(
      configuredAuthorizedParties({
        webOrigin: 'https://wip.example',
        extensionOrigins:
          'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ).toEqual(['https://wip.example', 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']);
    expect(() => configuredAuthorizedParties({ webOrigin: 'https://wip.example/path' })).toThrow(
      /exact/i,
    );
    expect(() =>
      configuredAuthorizedParties({ extensionOrigins: 'chrome-extension://*/' }),
    ).toThrow(/exact/i);
  });
});
