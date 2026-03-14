# PDI v2 — Validation Checklist (RLS + lifecycle + derived status)

This checklist is intended to be run after applying migrations **053–057** and deploying the v2 frontend (`src/modules/pdi`).

## 1) Schema & data integrity

- **Tables exist**
  - `competencies`
  - `pdi_gaps`
  - `pdi_actions` has `pdi_gap_id` + `created_by` and `pdi_objective_id` is nullable
- **Backups exist**
  - `_legacy_backup_20260304_pdi_objectives`
  - `_legacy_backup_20260304_pdi_actions`
  - `_legacy_backup_20260304_pdi_checkins`
- **Backfill sanity**
  - For an existing PDI with objectives/actions, confirm:
    - `pdi_gaps` rows were created for legacy objectives
    - `pdi_actions.pdi_gap_id` is set for legacy actions

## 2) Multi-tenant isolation (RLS)

### Test data roles

Create or identify these users:

- TenantA: `employeeA`, `managerA`, `hrA`
- TenantB: `employeeB`, `managerB`, `hrB`

Ensure:

- `employeeA.tenant_id = managerA.tenant_id = hrA.tenant_id = TenantA`
- `employeeB.tenant_id = managerB.tenant_id = hrB.tenant_id = TenantB`
- `employeeA.manager_id = managerA.id` and `employeeB.manager_id = managerB.id`

### RLS assertions (high-signal)

- **Tenant boundary**
  - As `hrA`, ensure you **cannot** `SELECT` PDIs (`pdis`) from TenantB.
  - As `managerA`, ensure you **cannot** see `pdi_gaps` / `pdi_actions` linked to TenantB PDIs.
- **Employee boundary**
  - As `employeeA`, ensure you can `SELECT` your own PDI rows, gaps, actions, check-ins.
  - As `employeeA`, ensure you cannot `INSERT/UPDATE/DELETE` `pdi_gaps` or `pdi_actions` (unless explicitly allowed by your project rules).
- **Manager boundary**
  - As `managerA`, ensure you can `SELECT` PDIs for direct reports and manage gaps/actions within those PDIs.
  - As `managerA`, ensure you cannot manage PDIs for users who are not direct reports.
- **HR boundary**
  - As `hrA`, ensure you can manage (insert/update) PDIs/gaps/actions within TenantA.
  - As `hrA`, ensure delete operations are allowed only where the policy says HR-only.

## 3) Workflow lifecycle (stored status on `pdis`)

Validate the stored workflow transitions still work in the UI:

- `draft` → `in_approval` (manager/HR)
- `in_approval` → `active` (HR)
- `in_approval` → `draft` (HR rejects)
- `active` → `closed` (manager/HR)
- `closed` → `archived` (HR)

## 4) Derived progress status (not stored)

Derived status is computed in the frontend (`derivePdiStatus`):

- **completed**
  - all actions are `completed` and there is at least 1 action
- **overdue**
  - at least one non-completed action has `due_date < today (UTC date)`
- **in_progress**
  - otherwise (including 0 actions)

### Edge cases to verify

- **No actions** → `in_progress`
- **Due date today** (UTC date) → not overdue
- **Mixed actions** (one overdue pending, others completed) → overdue
- **All completed but progress_pct not 100** → completed is determined by status rule at PDI-level (all completed)

## 5) “No hidden automation”

Confirm:

- Course progress no longer updates PDI actions (course triggers removed).
- PDI UI no longer exposes course-linked actions or “synced from course” UX.
- PDI progress is computed from loaded actions, not RPCs.

