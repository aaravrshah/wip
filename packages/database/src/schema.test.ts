import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, test } from 'vitest';

import { ownedTables, owners } from './schema';

describe('database ownership schema', () => {
  test('gives every user-owned table an explicit non-null owner identifier', () => {
    expect(Object.keys(ownedTables)).toHaveLength(10);

    for (const [tableName, table] of Object.entries(ownedTables)) {
      const ownerColumn = getTableColumns(table).ownerId;
      expect(ownerColumn, `${tableName} should define ownerId`).toBeDefined();
      expect(ownerColumn?.notNull, `${tableName}.ownerId should be non-null`).toBe(true);
    }
  });

  test('enables a read-only authenticated policy on every owner-scoped table', () => {
    for (const [tableName, table] of Object.entries({ owners, ...ownedTables })) {
      const config = getTableConfig(table);
      expect(config.enableRLS, `${tableName} should enable RLS`).toBe(true);
      expect(config.policies, `${tableName} should define an RLS policy`).toHaveLength(1);
      expect(config.policies[0]?.for).toBe('select');
      expect(config.policies[0]?.to).toMatchObject({ name: 'authenticated' });
    }
  });

  test('forces RLS and gives the runtime role read-only grants in the checked-in migration', () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, '../drizzle/0002_clerk_auth_rls.sql'),
      'utf8',
    );

    expect(migration.match(/FORCE ROW LEVEL SECURITY/g)).toHaveLength(11);
    expect(migration).toMatch(/rolbypassrls[\s\S]*must not have BYPASSRLS/);
    expect(migration).not.toMatch(/ALTER ROLE authenticated/);
    expect(migration).toMatch(/GRANT SELECT ON TABLE/);
    expect(migration).not.toMatch(/GRANT (INSERT|UPDATE|DELETE) ON TABLE/);
    expect(migration).toMatch(/wip_provision_owner\(\)/);
    expect(migration).not.toMatch(/wip_provision_owner\([^)]{1,}\)/);
  });
});
