-- Drizzle metadata synchronization only.
-- Migration 0007 already added wip_runtime to every policy with reviewed custom SQL.
-- This no-op migration advances drizzle-kit's schema snapshot so future drift checks do not
-- propose redundant ALTER POLICY statements for that already-applied runtime role.
select 1;
