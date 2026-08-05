import { getTableColumns } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';

import { ownedTables } from './schema';

describe('database ownership schema', () => {
  test('gives every user-owned table an explicit non-null owner identifier', () => {
    expect(Object.keys(ownedTables)).toHaveLength(10);

    for (const [tableName, table] of Object.entries(ownedTables)) {
      const ownerColumn = getTableColumns(table).ownerId;
      expect(ownerColumn, `${tableName} should define ownerId`).toBeDefined();
      expect(ownerColumn?.notNull, `${tableName}.ownerId should be non-null`).toBe(true);
    }
  });
});
