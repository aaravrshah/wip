import { describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseServerEnvironment } from './server';

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
    ).toThrow(/requires neon_authenticated_database_url and the clerk/i);
  });

  test('requires the passwordless authenticated Neon role', () => {
    expect(() =>
      parseServerEnvironment({
        NODE_ENV: 'development',
        WIP_DATA_SOURCE: 'neon',
        NEON_AUTHENTICATED_DATABASE_URL:
          'postgresql://owner:password@example-pooler.invalid/placeholder?sslmode=require',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
        CLERK_SECRET_KEY: 'sk_test_placeholder',
      }),
    ).toThrow(/authenticated database role/i);
  });

  test('returns validated authenticated Neon settings without an owner override', () => {
    expect(
      parseServerEnvironment({
        NODE_ENV: 'development',
        WIP_DATA_SOURCE: 'neon',
        NEON_AUTHENTICATED_DATABASE_URL:
          'postgresql://authenticated@example-pooler.invalid/placeholder?sslmode=require',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
        CLERK_SECRET_KEY: 'sk_test_placeholder',
        CLERK_JWT_TEMPLATE: 'wip-neon',
      }),
    ).toEqual({
      dataSource: 'neon',
      authenticatedDatabaseUrl:
        'postgresql://authenticated@example-pooler.invalid/placeholder?sslmode=require',
      clerkJwtTemplate: 'wip-neon',
    });
  });
});
