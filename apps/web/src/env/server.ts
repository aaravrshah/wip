import 'server-only';

import { z } from 'zod';

const baseEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WIP_DATA_SOURCE: z.enum(['demo', 'neon']).optional(),
  WIP_ALLOW_PRODUCTION_DEMO: z.enum(['true', 'false']).optional().default('false'),
  NEON_RUNTIME_DATABASE_URL: z
    .url()
    .startsWith('postgresql://')
    .refine((value) => new URL(value).username === 'wip_runtime', {
      message: 'NEON_RUNTIME_DATABASE_URL must use the wip_runtime database role.',
    })
    .refine((value) => new URL(value).password.length >= 32, {
      message: 'NEON_RUNTIME_DATABASE_URL must include a strong role password.',
    })
    .refine((value) => new URL(value).hostname.includes('-pooler'), {
      message: 'NEON_RUNTIME_DATABASE_URL must use the pooled Neon hostname.',
    })
    .optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  CLERK_SECRET_KEY: z.string().startsWith('sk_').optional(),
});

export type ServerEnvironment =
  { dataSource: 'demo' } | { dataSource: 'neon'; runtimeDatabaseUrl: string };

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
    !environment.NEON_RUNTIME_DATABASE_URL ||
    !environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !environment.CLERK_SECRET_KEY
  ) {
    throw new Error(
      'WIP_DATA_SOURCE=neon requires NEON_RUNTIME_DATABASE_URL and the Clerk publishable and secret keys.',
    );
  }

  return {
    dataSource: 'neon',
    runtimeDatabaseUrl: environment.NEON_RUNTIME_DATABASE_URL,
  };
}

export function getServerEnvironment(): ServerEnvironment {
  if (cachedEnvironment) return cachedEnvironment;

  cachedEnvironment = parseServerEnvironment(process.env);
  return cachedEnvironment;
}
