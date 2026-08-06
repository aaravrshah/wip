import { describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseExtensionOrigins, parseServerEnvironment } from './server';

describe('server environment selection', () => {
  test('uses demo data by default outside production', () => {
    expect(parseServerEnvironment({ NODE_ENV: 'development' })).toEqual({ dataSource: 'demo' });
  });

  test('does not silently use demo data in production', () => {
    expect(() => parseServerEnvironment({ NODE_ENV: 'production' })).toThrow(
      /disabled in production/i,
    );
  });

  test('requires a deliberate override for a production-mode demo build', () => {
    expect(
      parseServerEnvironment({
        NODE_ENV: 'production',
        WIP_DATA_SOURCE: 'demo',
        WIP_ALLOW_PRODUCTION_DEMO: 'true',
      }),
    ).toEqual({ dataSource: 'demo' });
  });

  test('requires server database configuration when Neon is selected', () => {
    expect(() =>
      parseServerEnvironment({ NODE_ENV: 'development', WIP_DATA_SOURCE: 'neon' }),
    ).toThrow(/requires neon_runtime_database_url and the clerk/i);
  });

  test('requires the least-privilege password-protected runtime role', () => {
    expect(() =>
      parseServerEnvironment({
        NODE_ENV: 'development',
        WIP_DATA_SOURCE: 'neon',
        NEON_RUNTIME_DATABASE_URL:
          'postgresql://owner:password@example-pooler.invalid/placeholder?sslmode=require',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
        CLERK_SECRET_KEY: 'sk_test_placeholder',
      }),
    ).toThrow(/wip_runtime database role/i);
  });

  test('returns validated runtime Neon settings without an owner override', () => {
    const runtimeDatabaseUrl = `postgresql://wip_runtime:${'a'.repeat(64)}@example-pooler.invalid/placeholder?sslmode=require`;
    expect(
      parseServerEnvironment({
        NODE_ENV: 'development',
        WIP_DATA_SOURCE: 'neon',
        NEON_RUNTIME_DATABASE_URL: runtimeDatabaseUrl,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
        CLERK_SECRET_KEY: 'sk_test_placeholder',
      }),
    ).toEqual({
      dataSource: 'neon',
      runtimeDatabaseUrl,
    });
  });

  test('accepts only exact Chrome extension origins', () => {
    expect(
      parseExtensionOrigins(
        'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ),
    ).toHaveLength(2);
    expect(() => parseExtensionOrigins('chrome-extension://*/')).toThrow();
    expect(() => parseExtensionOrigins('https://extension.example.invalid')).toThrow();
  });
});
