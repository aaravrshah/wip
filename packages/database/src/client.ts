import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import type { BatchItem, BatchResponse } from 'drizzle-orm/batch';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import WebSocket from 'ws';

import * as schema from './schema';

export function createDatabase(connectionString: string) {
  const client = neon(connectionString);
  return drizzle({ client, schema });
}

/**
 * @deprecated Neon-managed JWT login is retained only for migration compatibility. Runtime Wip
 * requests use `withTenantDatabase` and a password-protected, NOBYPASSRLS role instead.
 */
export function createAuthenticatedDatabase(connectionString: string, authToken: string) {
  const client = neon(connectionString, { authToken });
  return drizzle({ client, schema });
}

export type WipDatabase = ReturnType<typeof createDatabase>;

type RuntimeTransaction = Parameters<
  Parameters<ReturnType<typeof drizzleServerless<typeof schema>>['transaction']>[0]
>[0];

function withSequentialBatch(transaction: RuntimeTransaction): WipDatabase {
  const database = transaction as unknown as WipDatabase;

  Object.defineProperty(database, 'batch', {
    configurable: true,
    value: async <U extends BatchItem<'pg'>, T extends Readonly<[U, ...U[]]>>(
      queries: T,
    ): Promise<BatchResponse<T>> => {
      const results: unknown[] = [];
      for (const query of queries) results.push(await query);
      return results as BatchResponse<T>;
    },
  });

  return database;
}

function validateClerkSubject(clerkSubject: string): void {
  if (!clerkSubject.trim() || clerkSubject.length > 255) {
    throw new Error('A verified Clerk subject is required for tenant database access.');
  }
}

/**
 * Runs one authenticated operation in a request-local transaction. Clerk has already verified the
 * subject before this boundary. The transaction-local claim is visible to RLS for this operation
 * only, and the pool is closed before returning so identity can never leak into another request.
 */
export async function withTenantDatabase<T>(
  connectionString: string,
  clerkSubject: string,
  operation: (database: WipDatabase) => Promise<T>,
): Promise<T> {
  validateClerkSubject(clerkSubject);
  neonConfig.webSocketConstructor = WebSocket;

  const pool = new Pool({ connectionString });
  const runtimeDatabase = drizzleServerless({ client: pool, schema });

  try {
    return await runtimeDatabase.transaction(async (transaction) => {
      const database = withSequentialBatch(transaction);
      await database.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: clerkSubject })}, true)`,
      );
      return operation(database);
    });
  } finally {
    await pool.end();
  }
}
