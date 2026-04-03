# Codebase Concerns

**Analysis Date:** 2026-03-27

## Tech Debt

**Very large “god” page modules (hard to change safely):**
- Issue: single file contains UI + state + data-fetch + business rules + integration calls, increasing regression risk and review complexity.
- Files: `src/pages/Evaluation.tsx` (≈1843 lines)
- Impact: bugs hide in edge cases; changes tend to be risky; difficult to add tests; performance issues (re-renders, multiple fetches) are harder to diagnose.
- Fix approach: extract into focused modules (data hooks, view components, service layer helpers), then add targeted tests for critical flows (submit evaluation, filtering/pagination, notifications).

**Auth state change handling partially disabled (session drift risk):**
- Issue: `supabase.auth.onAuthStateChange` subscription logic is commented out, so the app relies primarily on initial session fetch + manual refresh flows.
- Files: `src/contexts/AuthContext.tsx` (commented subscription block around auth changes)
- Impact: edge cases like token refresh, sign-out in another tab, password recovery flow, and session expiration can lead to stale UI state (logged-in UI while session invalid, or vice-versa).
- Fix approach: re-enable and harden auth event handling with explicit event cases, plus a single clear “session invalid” UX path.

**Tenant resolution defaults silently to “fake” tenant config (boundary ambiguity):**
- Issue: if tenant fetch fails or returns no data, a default tenant config is synthesized with slug-derived company name and is marked active.
- Files: `src/contexts/TenantContext.tsx` (`DEFAULT_SLUG`, `defaultTenantConfig`, and fallback `setTenant(...)` path)
- Impact: wrong-tenant routing errors can look like “valid” brand/app state; can mask configuration mistakes and cause confusing multi-tenant access behavior.
- Fix approach: distinguish “tenant not found” vs “tenant inactive” vs “network error”; show an explicit error screen and prevent app boot into a faux-tenant.

## Known Bugs

**Incorrectly structured condition blocks around notifications (logic/UX inconsistency):**
- Symptoms: toast success/error messages may not match the actual notify call result; indentation suggests a missing block.
- Files: `src/modules/pdi/components/PdiEvidencesManagerTab.tsx` (inside both approve/reject notification handling)
- Trigger: when `notifyErr` is present/absent, both toasts can potentially fire unexpectedly due to missing braces.
- Workaround: none in-code; user sees misleading feedback.

**Debug console logging in production UI path:**
- Symptoms: sensitive-ish runtime objects (session presence) may be logged; noisy console; potential policy issues.
- Files: `src/modules/pdi/components/PdiEvidencesManagerTab.tsx` (`console.log('session', session);`)
- Trigger: approving an evidence runs refresh + notify block.
- Workaround: none.

## Security Considerations

**Frontend manually attaches Bearer tokens to Edge Function calls (requires strict server-side enforcement):**
- Risk: client code calls multiple Supabase Edge Functions with `Authorization: Bearer ${session.access_token}`; if function-side validation is incomplete, privilege escalation is possible.
- Files:
  - `src/pages/Evaluation.tsx` (invokes `create-notification`, `send-notification-email`)
  - `src/pages/Colaboradores.tsx` (invokes `invite-employee`, fetches `delete-user`)
  - `src/components/courses/CourseAssignments.tsx` (invokes `send-mandatory-course-email`)
  - `src/modules/pdi/components/PdiEvidencesManagerTab.tsx` (invokes `pdi-evidence-review-notify`)
- Current mitigation: presumed Supabase JWT validation + RLS; some flows call `supabase.auth.refreshSession()` before invoking.
- Recommendations: ensure each Edge Function validates JWT, tenant scope, and role/ownership explicitly (do not rely on the client payload); centralize invocation wrappers to reduce mistakes and standardize error handling.

**Public certificate verification endpoint (no auth) must be hardened against enumeration:**
- Risk: certificate verification is intentionally public via RPC; if codes are guessable or error messages leak info, it can be abused for scraping.
- Files: `src/services/certificateService.ts` (`getCertificateForVerification`, `NEW_CERTIFICATE_CODE_REGEX`)
- Current mitigation: codes appear constrained (10 hex chars), legacy codes may exist.
- Recommendations: rate-limit at the edge, return uniform “not found” responses, and ensure codes are sufficiently random at generation.

## Performance Bottlenecks

**Sequential Edge Function invocations in loops (latency and rate-limit risk):**
- Problem: per-user function invocation in a `for` loop for email notifications after assignment changes.
- Files: `src/components/courses/CourseAssignments.tsx` (`handleAssignSelected`, `handleAssignAll`)
- Cause: invokes `send-mandatory-course-email` for each user id sequentially.
- Improvement path: batch in a single Edge Function call (send many emails), or queue server-side; at minimum, parallelize with backpressure and robust retries.

**Multiple DB updates in parallel without throttling (quota/rate-limit risk):**
- Problem: reorder updates create many `update(...)` calls and runs `Promise.all`.
- Files: `src/services/courseService.ts` (`reorderRoadmapItems`)
- Cause: one update per roadmap item.
- Improvement path: use a single SQL function/RPC to apply ordering in one transaction, or perform batched updates.

**N+1-ish pattern for enriching dashboard activity (extra queries and complexity):**
- Problem: dashboard recent activity fetches PDIs then separately fetches profile names.
- Files: `src/services/dashboardService.ts` (`getRecentActivity`)
- Cause: 2-step fetch with `.in('id', employeeIds)`.
- Improvement path: move to a single view/RPC that returns joined data; reduces client logic and failure modes.

## Fragile Areas

**Blank-screen UX via `return null` on missing data (hard to debug, poor resiliency):**
- Files (examples): `src/pages/Evaluation.tsx`, `src/contexts/TenantContext.tsx`, `src/contexts/AuthContext.tsx`, `src/hooks/usePeriodicityWindow.ts`, `src/services/courseService.ts`
- Why fragile: null returns hide whether the app is loading, unauthorized, misconfigured, or errored; users see “nothing”.
- Safe modification: replace with explicit empty/error states (skeletons + call-to-action) and telemetry/toast where appropriate.
- Test coverage: minimal UI tests detected (`src/test/example.test.ts` plus a few service tests); no coverage for these null-return UX branches.

**Client-side file processing & uploads (browser variability and memory constraints):**
- Files: `src/services/avatarService.ts`, `src/services/courseService.ts`, `src/modules/pdi/services/pdiEvidenceService.ts`
- Why fragile: image resize uses canvas; large files, device memory, and Safari quirks can break flows; some uploads are private buckets requiring policy correctness.
- Safe modification: keep validation centralized and align bucket/policy expectations; add user-facing progress/error handling; consider moving heavy transforms server-side if needed.

## Scaling Limits

**Hard-coded list limits that can become “silent truncation”:**
- Files: `src/services/courseService.ts` (`listCourses` default `limit = 1000`), `src/components/courses/CourseAssignments.tsx` (`SEARCH_LIMIT = 10`)
- Current capacity: acceptable for small tenants; risks missing data for larger tenants.
- Limit: lists may appear incomplete without obvious indicators; UX confusion and support burden.
- Scaling path: server-side pagination everywhere, visible “showing X of Y”, and conservative defaults.

## Dependencies at Risk

**No explicit concern detected from dependencies alone:**
- Files: `package.json`
- Risk: not detected.
- Impact: not applicable.
- Migration plan: not applicable.

## Missing Critical Features

**Centralized API/service error normalization + user-facing error states:**
- Problem: many services throw raw Supabase errors and pages often decide between “toast + null” without consistent patterns.
- Files: `src/services/*.ts`, `src/pages/Evaluation.tsx`, `src/pages/Colaboradores.tsx`, `src/services/dashboardService.ts`
- Blocks: consistent UX for offline/timeout/session-expired, and reliable debugging/observability.

## Test Coverage Gaps

**Very small test suite relative to surface area (high regression risk):**
- What's not tested: core pages and flows (auth/tenant boot, evaluation submission, employee management, edge-function flows, storage upload flows).
- Files (evidence): tests detected only at:
  - `src/services/avatarService.test.ts`
  - `src/services/certificateService.test.ts`
  - `src/modules/pdi/utils/derivePdiStatus.test.ts`
  - `src/lib/periodicity.test.ts`
  - `src/test/example.test.ts`
- Risk: changes in `src/pages/Evaluation.tsx`, auth/tenant contexts, or service RPC payload shapes can break production without detection.
- Priority: **High** (add smoke tests for boot/auth/tenant; then service-layer unit tests for RPC contracts and key edge-function invocation wrappers).

---

*Concerns audit: 2026-03-27*
