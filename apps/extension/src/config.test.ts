import { afterEach, describe, expect, test, vi } from 'vitest';

import { DEVELOPMENT_EXTENSION_ID } from './extension-identity';
import { getExtensionConfig } from './config';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('extension runtime configuration', () => {
  test('accepts the reviewed stable development ID and exact public origins', () => {
    vi.stubEnv('WXT_WIP_API_ORIGIN', 'https://wip.example.invalid');
    vi.stubEnv('WXT_CLERK_PUBLISHABLE_KEY', 'pk_test_fictional');
    vi.stubGlobal('chrome', { runtime: { id: DEVELOPMENT_EXTENSION_ID } });

    expect(getExtensionConfig()).toMatchObject({
      apiOrigin: 'https://wip.example.invalid',
      expectedExtensionId: DEVELOPMENT_EXTENSION_ID,
      webSignInUrl: 'https://wip.example.invalid/sign-in',
    });
  });

  test('fails closed when Chrome assigns a different extension ID', () => {
    vi.stubEnv('WXT_CLERK_PUBLISHABLE_KEY', 'pk_test_fictional');
    vi.stubGlobal('chrome', { runtime: { id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } });

    expect(() => getExtensionConfig()).toThrow(/expected extension ID/i);
  });
});
