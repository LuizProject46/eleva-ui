# Automated evaluation periods (periodicity → `evaluation_periods`)

## What was added

- **Schema** ([`supabase/migrations/079_evaluation_periods_auto_generation.sql`](../../supabase/migrations/079_evaluation_periods_auto_generation.sql)): optional `source_entity_type`, `is_auto_generated`, `auto_cycle_start_date`, `auto_interval_kind`, `generated_from_config_at`; nullable `semester` for non-semiannual cycles; partial unique index for idempotent auto rows.
- **RPC** ([`supabase/migrations/080_generate_evaluation_periods_rpc.sql`](../../supabase/migrations/080_generate_evaluation_periods_rpc.sql)):
  - `generate_evaluation_periods_for_entity(tenant_id, entity_type, past_cycles, future_cycles)` — `service_role` only.
  - `generate_evaluation_periods_all_tenants(past_cycles, future_cycles)` — `service_role` only; returns JSON summary.
- **Edge Function** `auto-generate-evaluation-periods`: calls the RPC; disable with env `AUTO_EVALUATION_PERIODS_ENABLED=false`.
- **Cron** ([`supabase/migrations/081_cron_auto_evaluation_periods.sql`](../../supabase/migrations/081_cron_auto_evaluation_periods.sql)): daily **08:15 UTC** (after `check-periodicity-deadlines` at 08:00), same Vault/pg_cron prerequisites as migration 024.

## Rollout (staged)

1. **Apply migrations** 079–081 to staging/production in order.
2. **Deploy** the Edge Function `auto-generate-evaluation-periods` and set secrets (no extra secrets beyond existing `SUPABASE_SERVICE_ROLE_KEY` in the function runtime).
3. **Backfill once** (staging first): invoke the function with POST `{}` or call RPC `generate_evaluation_periods_all_tenants(2, 6)` via SQL editor as `service_role` / dashboard.
4. **Verify** (see below); then rely on cron or keep manual invocations if cron is not available (local dev without Vault skips cron schedule).
5. **Kill switch**: set `AUTO_EVALUATION_PERIODS_ENABLED=false` on the function if you need to stop generation without reverting migrations.

## Behaviour notes

- Cycles use the same **day-based** lengths as `get_interval_days` / `get_period_containing_date` (aligned with existing submission windows).
- Rows with `source_entity_type = 'assessment'` are **not** shown in 360° / Nine-box period pickers (only `NULL` or `evaluation`).
- Manual HR rows remain `is_auto_generated = false` and are never updated by the generator.
- **Nine-box competency mode** still requires `semester === 2`; auto periods with `semester` null (e.g. quarterly) use legacy matrix behaviour for that period.

## Verification checklist

- [ ] After backfill, tenants with `periodicity_config` have new `evaluation_periods` rows with `is_auto_generated = true` and matching `auto_cycle_start_date`.
- [ ] No duplicate auto rows per `(tenant_id, source_entity_type, auto_cycle_start_date)` (unique index).
- [ ] Existing evaluations with manual `period_id` unchanged.
- [ ] Evaluation form period dropdown lists only evaluation + legacy periods; order is by `starts_at` descending.
- [ ] Re-run RPC: no spurious new rows; existing auto rows may refresh `name` / bounds if config changed.
