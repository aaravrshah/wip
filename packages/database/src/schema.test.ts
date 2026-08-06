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

  test('keeps a SELECT policy on every table and adds writes only to implemented mutable tables', () => {
    for (const [tableName, table] of Object.entries({ owners, ...ownedTables })) {
      const config = getTableConfig(table);
      expect(config.enableRLS, `${tableName} should enable RLS`).toBe(true);
      expect(config.policies.some((policy) => policy.for === 'select')).toBe(true);
      for (const policy of config.policies) {
        expect(policy.to).toMatchObject({ name: 'authenticated' });
      }
    }

    expect(getTableConfig(ownedTables.applications).policies).toHaveLength(4);
    expect(getTableConfig(ownedTables.applicationEvents).policies).toHaveLength(2);
    expect(getTableConfig(ownedTables.jobDescriptionSnapshots).policies).toHaveLength(2);
    expect(getTableConfig(ownedTables.notes).policies).toHaveLength(4);
    expect(getTableConfig(ownedTables.nextActions).policies).toHaveLength(4);
    expect(getTableConfig(ownedTables.documents).policies).toHaveLength(3);
    expect(getTableConfig(ownedTables.documentVersions).policies).toHaveLength(2);
    expect(getTableConfig(ownedTables.applicationDocumentUses).policies).toHaveLength(3);
    expect(getTableConfig(ownedTables.contacts).policies).toHaveLength(4);
    expect(getTableConfig(ownedTables.applicationContacts).policies).toHaveLength(4);
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

  test('grants narrowly scoped mutations without weakening immutable tables', () => {
    const policyMigration = readFileSync(
      resolve(import.meta.dirname, '../drizzle/0003_silky_the_fallen.sql'),
      'utf8',
    );
    const grantMigration = readFileSync(
      resolve(import.meta.dirname, '../drizzle/0004_broad_tombstone.sql'),
      'utf8',
    );

    expect(policyMigration).toMatch(/applications_owner_insert/);
    expect(policyMigration).toMatch(/notes_owner_update/);
    expect(policyMigration).toMatch(/next_actions_owner_delete/);
    expect(policyMigration).toMatch(/application_events_owner_insert/);
    expect(policyMigration).not.toMatch(/application_events_owner_(update|delete)/);
    expect(policyMigration).not.toMatch(/job_description_snapshots_owner_(update|delete)/);
    expect(grantMigration).toMatch(/GRANT DELETE ON public\.applications TO authenticated/);
    expect(grantMigration).toMatch(/GRANT INSERT \([\s\S]*public\.application_events/);
    expect(grantMigration).not.toMatch(/GRANT UPDATE[^;]*application_events/);
    expect(grantMigration).not.toMatch(/GRANT (UPDATE|DELETE)[^;]*job_description_snapshots/);
  });

  test('adds least-privilege metadata writes and identity-derived tracker deletion', () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, '../drizzle/0005_milestone_1c_tracker.sql'),
      'utf8',
    );

    expect(migration).toMatch(/GRANT INSERT \(id, owner_id, display_name/);
    expect(migration).toMatch(/GRANT UPDATE \(display_name/);
    expect(migration).toMatch(/GRANT INSERT \([\s\S]*public\.document_versions/);
    expect(migration).not.toMatch(/GRANT UPDATE[^;]*document_versions/);
    expect(migration).not.toMatch(/GRANT DELETE[^;]*document_versions/);
    expect(migration).toMatch(/wip_delete_tracker_data\(\)/);
    expect(migration).not.toMatch(/wip_delete_tracker_data\([^)]{1,}\)/);
    expect(migration).toMatch(/current_owner_id := public\.wip_current_owner_id\(\)/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.wip_delete_tracker_data/);

    const settingsMigration = readFileSync(
      resolve(import.meta.dirname, '../drizzle/0006_tracker-deletion-settings.sql'),
      'utf8',
    );
    expect(settingsMigration).toMatch(/wip_delete_tracker_data\(\)/);
    expect(settingsMigration).not.toMatch(/wip_delete_tracker_data\([^)]{1,}\)/);
    expect(settingsMigration).toMatch(/timezone = 'UTC'/);
    expect(settingsMigration).toMatch(/locale = NULL/);
    expect(settingsMigration).toMatch(/week_starts_on = NULL/);
  });
});
