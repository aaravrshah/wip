import { createHash } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import { DEVELOPMENT_EXTENSION_ID, DEVELOPMENT_EXTENSION_PUBLIC_KEY } from './extension-identity';
import { createExtensionManifest } from './manifest';

function extensionId(publicKey: string) {
  return [
    ...createHash('sha256').update(Buffer.from(publicKey, 'base64')).digest('hex').slice(0, 32),
  ]
    .map((digit) => String.fromCharCode(97 + Number.parseInt(digit, 16)))
    .join('');
}

describe('extension manifest permission boundary', () => {
  test('uses only user-invoked capture and temporary draft permissions', () => {
    const manifest = createExtensionManifest({
      apiOrigin: 'http://localhost:3000',
      clerkFrontendApiOrigin: 'https://clerk.example.invalid',
      extensionPublicKey: DEVELOPMENT_EXTENSION_PUBLIC_KEY,
    });
    expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage']);
    expect(manifest.host_permissions).toEqual([
      'http://localhost:3000/*',
      'https://clerk.example.invalid/*',
    ]);
    expect(extensionId(manifest.key)).toBe(DEVELOPMENT_EXTENSION_ID);
    expect(manifest.icons).toEqual({
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    });
    expect(manifest.content_security_policy.extension_pages).toBe(
      "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    expect(JSON.stringify(manifest)).not.toMatch(
      /<all_urls>|\*:\/\/|unsafe-eval|unsafe-inline|history|cookies|downloads|webRequest|declarativeNetRequest|unlimitedStorage|"tabs"/i,
    );
  });

  test('rejects wildcard or path-bearing configured origins', () => {
    expect(() =>
      createExtensionManifest({
        apiOrigin: 'https://*.example.invalid',
        clerkFrontendApiOrigin: 'https://clerk.example.invalid',
        extensionPublicKey: DEVELOPMENT_EXTENSION_PUBLIC_KEY,
      }),
    ).toThrow();
    expect(() =>
      createExtensionManifest({
        apiOrigin: 'https://wip.example.invalid/api',
        clerkFrontendApiOrigin: 'https://clerk.example.invalid',
        extensionPublicKey: DEVELOPMENT_EXTENSION_PUBLIC_KEY,
      }),
    ).toThrow(/exact/i);
  });
});
