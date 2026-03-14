-- Migration 067: Drop all _legacy_backup_* tables (e.g. from PDI v2 cutover).
-- Run only after rollback is no longer needed.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE '_legacy_backup_%'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I.%I', r.schemaname, r.tablename);
    RAISE NOTICE 'Dropped table: %.%', r.schemaname, r.tablename;
  END LOOP;
END $$;
