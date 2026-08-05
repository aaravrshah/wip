import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

export function createDatabase(connectionString: string) {
  const client = neon(connectionString);
  return drizzle({ client, schema });
}

export type WipDatabase = ReturnType<typeof createDatabase>;
