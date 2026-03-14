# PDI Module Audit Report (pre-refactor)

This document maps the current PDI implementation (Supabase + React) to support a safe refactor.

## Scope

- Supabase: tables, triggers/automation, RPCs, and RLS policies related to PDI
- Frontend: services, pages, components, and the main coupling points to other modules (Courses, Evaluation/DISC)

## Supabase — Current Data Model

### Core tables

- **`pdis`** (plan container; one per employee per period)
  - Defined in [`supabase/migrations/045_pdis.sql`](supabase/migrations/045_pdis.sql)
  - Key fields
    - `tenant_id`, `employee_id`, `start_date`, `end_date`
    - `origin` (`evaluation|disc|feedback`), optional `evaluation_id`, `behavioral_assessment_id`
    - **workflow** `status` (`draft|in_approval|active|closed|archived`) — archived added in [`supabase/migrations/048_pdi_status_archived.sql`](supabase/migrations/048_pdi_status_archived.sql)
    - closing fields: `closed_at`, `result`, `close_comment`
  - Trigger: `pdis_updated_at` uses `set_pdis_updated_at()` (simple `updated_at` maintenance)

- **`pdi_objectives`** (“goals”; effectively the current per-competency/per-topic container)
  - Defined in [`supabase/migrations/045_pdis.sql`](supabase/migrations/045_pdis.sql)
  - Key fields: `pdi_id`, `description`, optional `competency` (free text), `priority`, `due_date`, `position`
  - “Objective status” history:
    - Added in [`supabase/migrations/050_pdi_objective_status.sql`](supabase/migrations/050_pdi_objective_status.sql)
    - Then triggers/RPCs for auto-derive were removed in [`supabase/migrations/051_pdi_objective_status_manual_only.sql`](supabase/migrations/051_pdi_objective_status_manual_only.sql)
    - Finally dropped again in [`supabase/migrations/052_pdi_goals_action_plans_refactor.sql`](supabase/migrations/052_pdi_goals_action_plans_refactor.sql)

- **`pdi_actions`** (action plans)
  - Defined in [`supabase/migrations/045_pdis.sql`](supabase/migrations/045_pdis.sql) and extended in [`supabase/migrations/052_pdi_goals_action_plans_refactor.sql`](supabase/migrations/052_pdi_goals_action_plans_refactor.sql)
  - Key fields (current)
    - `pdi_objective_id`, `description`
    - **`type`** (`course|practice`)
    - `responsible_user_id`
    - `status` (`pending|in_progress|completed`)
    - **course coupling**: `course_assignment_id`
    - **derived/duplicated**: `progress_pct` (0–100), `completion_criteria`

- **`pdi_checkins`** (check-in history)
  - Defined in [`supabase/migrations/045_pdis.sql`](supabase/migrations/045_pdis.sql) and refactored in [`supabase/migrations/049_pdi_checkins_mvp.sql`](supabase/migrations/049_pdi_checkins_mvp.sql)
  - Key fields (current)
    - `pdi_id`, `author_id`, `checkin_date`
    - `overall_status` (snapshot: `not_started|in_progress|completed`)
    - `manager_comment`, `employee_comment`

## Supabase — Hidden Automation & Coupling

### Course → PDI automation (must be removed)

- Triggers on course progress tables that update PDI action status/progress:
  - Migration: [`supabase/migrations/046_pdi_course_completion_sync.sql`](supabase/migrations/046_pdi_course_completion_sync.sql)
    - Triggers: `pdi_sync_on_roadmap_progress`, `pdi_sync_on_questionnaire_attempt`
    - Function: `public.sync_pdi_actions_on_course_completion()`
  - Migration: [`supabase/migrations/052_pdi_goals_action_plans_refactor.sql`](supabase/migrations/052_pdi_goals_action_plans_refactor.sql)
    - Function upgraded to sync **both** `progress_pct` and `status`
    - Adds `get_course_assignment_progress()` as supporting stored logic

Impact:

- PDI state changes implicitly when users interact with Courses.
- PDI “progress_pct” becomes partially derived and partially stored, raising consistency risk.

### PDI progress/status RPCs (must be removed)

- `public.get_pdi_progress(p_pdi_id)` in [`supabase/migrations/045_pdis.sql`](supabase/migrations/045_pdis.sql)
- `public.get_pdi_action_progress(p_action_id)` in [`supabase/migrations/052_pdi_goals_action_plans_refactor.sql`](supabase/migrations/052_pdi_goals_action_plans_refactor.sql)
- `public.get_pdi_goal_progress(p_objective_id)` in [`supabase/migrations/052_pdi_goals_action_plans_refactor.sql`](supabase/migrations/052_pdi_goals_action_plans_refactor.sql)
- `public.get_course_assignment_progress(p_assignment_id)` in [`supabase/migrations/052_pdi_goals_action_plans_refactor.sql`](supabase/migrations/052_pdi_goals_action_plans_refactor.sql)

Impact:

- Progress/status becomes split between UI logic and database logic.
- Coupling to Courses persists through `SECURITY DEFINER` functions and triggers.

## Supabase — RLS Overview (current)

RLS policies for PDI tables were introduced in [`supabase/migrations/045_pdis.sql`](supabase/migrations/045_pdis.sql) and expanded later. They primarily implement:

- **Employee**: can view own PDIs; historically could update own assigned actions (policy later dropped and re-added in different forms).
- **Manager**: can view/manage direct report PDIs (checks `profiles.manager_id = auth.uid()`).
- **HR**: can view/manage tenant PDIs.

Current policies heavily depend on `SECURITY DEFINER` helpers:

- `public.get_my_profile_tenant_id()` / `public.get_my_profile_role()` (defined in [`supabase/migrations/002_tenants.sql`](supabase/migrations/002_tenants.sql) and earlier versions in [`supabase/migrations/001_create_profiles.sql`](supabase/migrations/001_create_profiles.sql)).

Notable risk:

- Policies include nested EXISTS + joins; some include scalar subqueries for tenant checks.
- The system already had to use helper functions to avoid recursion for `profiles` policies; those helpers then became widely reused across modules.

## Frontend — Current Dependencies & Data Flow

### Service layer

- All PDI CRUD and RPC calls are centralized in [`src/services/pdiService.ts`](src/services/pdiService.ts).
  - Uses RPCs:
    - `get_pdi_progress`
    - `get_pdi_goal_progress`
    - `get_pdi_action_progress`
  - Performance issue:
    - `listActionsByPdi(pdiId)` fetches objectives then performs **N** `pdi_actions` queries (N+1).

### Pages

- PDI List: [`src/pages/PdiList.tsx`](src/pages/PdiList.tsx)
  - Uses `listPdis()` + a second query to fetch employee profiles
  - Depends on workflow status labels from [`src/lib/pdiLifecycle.ts`](src/lib/pdiLifecycle.ts)

- PDI Detail: [`src/pages/PdiDetail.tsx`](src/pages/PdiDetail.tsx)
  - Loads: `getPdi`, objectives, actions, checkins, and progress (RPC)
  - Renders separate sections:
    - Context, Diagnostic (Evaluation/DISC), Objectives/Actions, Check-ins, Approval, Close, Archive

### Components

- Objectives/Actions: [`src/components/pdi/PdiObjectivesSection.tsx`](src/components/pdi/PdiObjectivesSection.tsx)
  - Contains UI for **course actions**:
    - `type='course'` selection
    - course assignment search (`course_assignments` + `courses`)
    - copy: “Sincronizado com o curso”
  - Contains action progress UI for practice actions (manual progress)
  - Computes goal progress in UI (`computeGoalProgress`) mirroring DB function semantics.

- Diagnostic coupling (Evaluation/DISC): [`src/components/pdi/PdiDiagnosticSection.tsx`](src/components/pdi/PdiDiagnosticSection.tsx)
  - Reads:
    - `evaluation_scores`, `evaluation_competencies`
    - `behavioral_assessments`
  - Writes:
    - creates PDI objectives based on low-score competencies / DISC attention points

- Check-ins: [`src/components/pdi/PdiCheckinsSection.tsx`](src/components/pdi/PdiCheckinsSection.tsx)
  - Tied to `pdi.status === 'active'` for insert/update UI gating (workflow status).

## Key Findings (why refactor is needed)

- **Hidden automation**: course triggers mutate PDI actions in the background.
- **Derived state persistence**: `progress_pct` and some statuses are partly derived from Courses.
- **Cross-domain coupling**: PDI depends directly on course assignment progress semantics.
- **Performance**: N+1 action fetching on PDI detail.
- **RLS complexity**: policies rely on helper functions and multiple nested subqueries/joins.

