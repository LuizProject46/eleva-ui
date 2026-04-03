# External Integrations

**Analysis Date:** 2026-03-27

## APIs & External Services

**Supabase (core backend):**
- Used for Auth + database access + storage + Edge Functions
  - SDK/Client: `@supabase/supabase-js` (`package.json`)
  - Client initialization: `src/lib/supabase.ts`
  - Auth usage patterns: `src/contexts/AuthContext.tsx` (session load, sign-in, sign-out)
  - Edge Functions called from frontend:
    - `provision-tenant`: `src/pages/backoffice/BackofficeTenantCreate.tsx`
    - `invite-employee`: `src/pages/Colaboradores.tsx`
    - `delete-user`: `src/pages/Colaboradores.tsx` (direct fetch to `/functions/v1/delete-user`)
    - `send-notification-email`, `create-notification`: `src/pages/Evaluation.tsx`
    - `send-mandatory-course-email`: `src/components/courses/CourseAssignments.tsx`
    - `pdi-evidence-review-notify`: `src/modules/pdi/components/PdiEvidencesManagerTab.tsx`
  - Supabase schema/migrations: `supabase/migrations/*.sql`
  - Supabase Edge Functions (Deno): `supabase/functions/**`
  - Supabase Edge Function verification settings: `supabase/config.toml` (`verify_jwt = false` for several functions)

**Resend (transactional email via Edge Functions):**
- Used by Supabase Edge Functions to send whitelabel auth + onboarding emails
  - SDK: `resend@4.0.0` imported in `supabase/functions/send-email/index.ts` and `supabase/functions/provision-tenant/index.ts`
  - Send Email Hook (Supabase Auth webhook) implementation: `supabase/functions/send-email/index.ts`
  - Setup documentation: `README.md`, `docs/auth-email-templates.md`

**Standard Webhooks (webhook signature verification):**
- Used in `send-email` Edge Function to verify Supabase Auth hook payloads
  - Library: `standardwebhooks@1.0.0` imported in `supabase/functions/send-email/index.ts`

## Data Storage

**Databases:**
- Supabase Postgres
  - Migrations: `supabase/migrations/*.sql`
  - Client access: `src/lib/supabase.ts`

**File Storage:**
- Supabase Storage (buckets appear in migrations)
  - Example migrations: `supabase/migrations/028_avatars_bucket.sql`, `supabase/migrations/030_course_content_bucket.sql`

**Caching:**
- Client-side query cache via TanStack React Query (`src/App.tsx`)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Frontend env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`README.md`, `src/vite-env.d.ts`)
  - Supabase client config: `src/lib/supabase.ts` (persistent session; storage key `eleva-auth`)
  - Password reset flows routed in SPA: `src/App.tsx` (`/forgot-password`, `/reset-password`)
  - Branded auth emails via Send Email Hook: `docs/auth-email-templates.md`, `supabase/functions/send-email/templates/*.html`, `supabase/config.toml`

## Monitoring & Observability

**Error Tracking:**
- Not detected (no `@sentry/*`, `rollbar`, `datadog`, `logrocket`, etc. in `package.json` or `src/` scan)

**Logs:**
- Frontend: browser console usage only (no dedicated logging SDK detected)
- Edge Functions: uses `console.error` in functions such as `supabase/functions/send-email/index.ts`

## CI/CD & Deployment

**Hosting:**
- Not detected in repo config (README points to Lovable publish flow: `README.md`)

**CI Pipeline:**
- Not detected (no GitHub Actions config identified during scan)

## Environment Configuration

**Required env vars (frontend):**
- `VITE_SUPABASE_URL` (`README.md`, `src/lib/supabase.ts`)
- `VITE_SUPABASE_ANON_KEY` (`README.md`, `src/lib/supabase.ts`)

**Required secrets (Supabase Edge Functions):**
- `SUPABASE_URL` (Edge Functions env; used in `supabase/functions/send-email/index.ts`, `supabase/functions/provision-tenant/index.ts`)
- `SUPABASE_SERVICE_ROLE_KEY` (admin operations; used in `supabase/functions/send-email/index.ts`, `supabase/functions/provision-tenant/index.ts`)
- `SUPABASE_ANON_KEY` (token claim validation; used in `supabase/functions/provision-tenant/index.ts`)
- `RESEND_API_KEY` (email sending; used in `supabase/functions/send-email/index.ts`, `supabase/functions/provision-tenant/index.ts`)
- `RESEND_FROM_EMAIL` (sender; used in `supabase/functions/send-email/index.ts`, described in `docs/tenant-provisioning.md`)
- `SEND_EMAIL_HOOK_SECRET` (Supabase Auth hook verification; `supabase/functions/send-email/index.ts`, `docs/auth-email-templates.md`)
- `PROVISIONING_SECRET` (automation/backoffice provisioning; `supabase/functions/provision-tenant/index.ts`, `docs/tenant-provisioning.md`)
- `SITE_URL` (tenant onboarding email link base; described in `docs/tenant-provisioning.md`)

**Secrets location:**
- Supabase Dashboard → Edge Functions → Secrets (documented in `README.md`, `docs/auth-email-templates.md`, `docs/tenant-provisioning.md`)

## Webhooks & Callbacks

**Incoming:**
- Supabase Auth “Send Email Hook” → Edge Function `send-email`
  - Endpoint: `https://<project-ref>.supabase.co/functions/v1/send-email` (documented in `README.md`, `docs/auth-email-templates.md`)
  - Signature verification: `supabase/functions/send-email/index.ts`

**Outgoing:**
- Resend Emails API called from Edge Functions (`supabase/functions/send-email/index.ts`)

## Not Detected

- Payments (Stripe, etc.)
- Analytics (PostHog, Segment, Amplitude, etc.)
- Feature flags (LaunchDarkly, Unleash, etc.)
- i18n frameworks (`react-i18next`, Lingui, FormatJS, etc.)

---

*Integration audit: 2026-03-27*
