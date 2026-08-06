import { describe, expect, test } from 'vitest';

import { createExtensionManifest } from './manifest';

describe('extension manifest permission boundary', () => {
  test('uses only user-invoked capture and temporary draft permissions', () => {
    const manifest = createExtensionManifest({
      apiOrigin: 'http://localhost:3000',
      clerkFrontendApiOrigin: 'https://clerk.example.invalid',
    });
    expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage']);
    expect(manifest.host_permissions).toEqual([
      'http://localhost:3000/*',
      'https://clerk.example.invalid/*',
    ]);
    expect(JSON.stringify(manifest)).not.toMatch(
      /<all_urls>|\*:\/\/|history|cookies|downloads|webRequest|declarativeNetRequest|unlimitedStorage|"tabs"/i,
    );
  });

  test('rejects wildcard or path-bearing configured origins', () => {
    expect(() =>
      createExtensionManifest({
        apiOrigin: 'https://*.example.invalid',
        clerkFrontendApiOrigin: 'https://clerk.example.invalid',
      }),
    ).toThrow();
    expect(() =>
      createExtensionManifest({
        apiOrigin: 'https://wip.example.invalid/api',
        clerkFrontendApiOrigin: 'https://clerk.example.invalid',
      }),
    ).toThrow(/exact/i);
  });
});
