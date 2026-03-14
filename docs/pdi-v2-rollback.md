# PDI v2 — Rollback Strategy

This document describes how to roll back the PDI v2 cutover safely.

## What v2 changes

v2 introduces:

- `competencies` (tenant-scoped competency catalog)
- `pdi_gaps` (replaces `pdi_objectives` as the unit that contains competency + level gap)
- `pdi_actions.pdi_gap_id` and `pdi_actions.created_by` to support the v2 relationship and explicit permissions

Legacy tables are preserved during cutover.

## Backups created by migrations

Migration `054_pdi_v2_backup_and_backfill.sql` creates:

- `_legacy_backup_20260304_pdi_objectives`
- `_legacy_backup_20260304_pdi_actions`
- `_legacy_backup_20260304_pdi_checkins`

These are point-in-time snapshots taken before v2 writes begin.

## Rollback options

### Option A — Frontend-only rollback (preferred)

If the schema migration was applied but the cutover is failing:

- Revert the frontend to read/write legacy tables (`pdi_objectives` + `pdi_actions` via `pdi_objective_id`)
- Keep v2 tables in place (no data loss)

This is the safest rollback because it avoids any DB manipulation.

### Option B — Data rollback to backup snapshots (destructive; use only if needed)

If v2 writes have started and you need to restore the legacy state precisely:

- Stop the application / disable PDI writes temporarily.
- Restore legacy tables from snapshot backups.

Example (manual SQL):

- `TRUNCATE public.pdi_objectives; INSERT INTO public.pdi_objectives SELECT * FROM public._legacy_backup_20260304_pdi_objectives;`
- `TRUNCATE public.pdi_actions; INSERT INTO public.pdi_actions SELECT * FROM public._legacy_backup_20260304_pdi_actions;`
- `TRUNCATE public.pdi_checkins; INSERT INTO public.pdi_checkins SELECT * FROM public._legacy_backup_20260304_pdi_checkins;`

Then:

- Remove any frontend usage of `pdi_gaps` / `competencies`.

## Notes

- Avoid dropping v2 tables during rollback. Keep them for inspection and later re-cutover.
- If course-coupling triggers/RPCs were removed as part of cleanup, re-apply them by reverting the cleanup migration (git revert) or re-running their original migration definitions as needed.

