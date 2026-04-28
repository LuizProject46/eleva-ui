-- Optional manual checks after deploying auto evaluation periods (run in SQL editor as privileged role).

-- 1) Auto rows should be unique per (tenant, source entity, cycle start)
-- SELECT tenant_id, source_entity_type, auto_cycle_start_date, COUNT(*)
-- FROM evaluation_periods
-- WHERE is_auto_generated = true
-- GROUP BY 1, 2, 3
-- HAVING COUNT(*) > 1;

-- 2) Manual rows unchanged (spot-check: is_auto_generated should be false)
-- SELECT id, name, is_auto_generated, source_entity_type
-- FROM evaluation_periods
-- WHERE tenant_id = '<tenant_uuid>'
-- ORDER BY starts_at DESC
-- LIMIT 20;

-- 3) Idempotency: run twice and compare counts (should stabilize after first run)
-- SELECT public.generate_evaluation_periods_all_tenants(2, 6);
