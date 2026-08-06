import 'server-only';

import { z } from 'zod';

const baseEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WIP_DATA_SOURCE: z.enum(['demo', 'neon']).optional(),
  WIP_ALLOW_PRODUCTION_DEMO: z.enum(['true', 'false']).optional().default('false'),
  NEON_AUTHENTICATED_DATABASE_URL: z
    .url()
    .startsWith('postgresql://')
    .refine((value) => new URL(value).username === 'authenticated', {
      message: 'NEON_AUTHENTICATED_DATABASE_URL must use the authenticated database role.',
    })
    .refine((value) => new URL(value).password === '', {
      message: 'NEON_AUTHENTICATED_DATABASE_URL must be passwordless.',
    })
    .refine((value) => new URL(value).hostname.includes('-pooler'), {
      message: 'NEON_AUTHENTICATED_DATABASE_URL must use the pooled Neon hostname.',
    })
    .optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  CLERK_SECRET_KEY: z.string().startsWith('sk_').optional(),
  CLERK_JWT_TEMPLATE: z.string().trim().min(1).default('neon'),
});

export type ServerEnvironment =
  | { dataSource: 'demo' }
  | { dataSource: 'neon'; authenticatedDatabaseUrl: string; clerkJwtTemplate: string };

let cachedEnvironment: ServerEnvironment | undefined;

const extensionOriginSchema = z
  .string()
  .trim()
  .regex(/^chrome-extension:\/\/[a-p]{32}$/);

export function parseExtensionOrigins(value: string | undefined): readonly string[] {
  if (!value?.trim()) return [];
  return [...new Set(value.split(',').map((origin) => extensionOriginSchema.parse(origin)))];
}

export function getExtensionOrigins(): readonly string[] {
  return parseExtensionOrigins(process.env.WIP_EXTENSION_ORIGINS);
}

export function parseServerEnvironment(
  values: Record<string, string | undefined>,
): ServerEnvironment {
  const environment = baseEnvironmentSchema.parse(values);
  const dataSource = environment.WIP_DATA_SOURCE ?? 'demo';

  if (dataSource === 'demo') {
    if (environment.NODE_ENV === 'production' && environment.WIP_ALLOW_PRODUCTION_DEMO !== 'true') {
      throw new Error(
        'WIP_DATA_SOURCE=demo is disabled in production. Configure Neon or explicitly set WIP_ALLOW_PRODUCTION_DEMO=true for a non-deployed demo build.',
      );
    }

    return { dataSource: 'demo' };
  }

  if (
    !environment.NEON_AUTHENTICATED_DATABASE_URL ||
    !environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !environment.CLERK_SECRET_KEY
  ) {
    throw new Error(
      'WIP_DATA_SOURCE=neon requires NEON_AUTHENTICATED_DATABASE_URL and the Clerk publishable and secret keys.',
    );
  }

  return {
    dataSource: 'neon',
    authenticatedDatabaseUrl: environment.NEON_AUTHENTICATED_DATABASE_URL,
    clerkJwtTemplate: environment.CLERK_JWT_TEMPLATE,
  };
}

export function getServerEnvironment(): ServerEnvironment {
  if (cachedEnvironment) return cachedEnvironment;

  cachedEnvironment = parseServerEnvironment(process.env);
  return cachedEnvironment;
}
