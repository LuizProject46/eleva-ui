# Tenant Provisioning

This document describes how to create new tenants (companies) on the platform and how to access the internal backoffice.

## Overview

- **Tenants** are companies/organizations. Each tenant has a record in the `tenants` table (slug, company name, user limit, etc.).
- **Provisioning** creates a new tenant and its first user (the default HR administrator) in one flow.
- The same **provision-tenant** Edge Function is used by:
  1. **Backoffice UI** (platform admins, authenticated with JWT).
  2. **CLI/scripts** (automation, authenticated with `PROVISIONING_SECRET`).

## Platform administrators

The backoffice and tenant provisioning (when called from the UI) are restricted to **platform administrators**.

- A user is a platform admin if their profile has `is_platform_admin = true` in the `profiles` table.
- **Platform users** have no tenant: their `tenant_id` is NULL and must never be assigned. They can log in and access the app from any tenant slug (for branding/context) and can open the backoffice to manage all tenants.
- **Tenant users** (normal users) have a `tenant_id` and are restricted to the tenant identified by the URL slug. Tenant slug vs. user tenant is enforced by **TenantAccessGuard** and by AuthContext (`loadUser` / `login`): tenant users on a different slug are redirected to login with a message that access is only allowed for their company.
- There is no self-service; the first platform admin(s) must be set manually in the database.

### Setting the first platform admin

After the migration `069_platform_admin.sql` is applied:

**Option A — create a new backoffice admin (email + password)**  
Call the **create-backoffice-admin** Edge Function with `PROVISIONING_SECRET` (same as for provision-tenant). Example with curl:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-backoffice-admin" \
  -H "Authorization: Bearer YOUR_PROVISIONING_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@elevai.com","password":"YourSecurePassword","name":"Admin"}'
```

Body: `email` (required), `password` (required), `name` (optional). The function creates the user in Auth and sets `is_platform_admin = true` on their profile. Deploy the function and set `PROVISIONING_SECRET` in Supabase Edge Function secrets.

**Option B — promote an existing user**  
Edit `scripts/set-backoffice-admin.sql`, replace the email with your admin’s email, then run it in the Supabase SQL Editor. To set or reset their password, use Supabase Dashboard → Authentication → Users → select user → “Send password recovery” or update there.

That user can then log in to the app and open `/backoffice` to manage tenants.

## Creating a tenant via backoffice

1. Log in with a user that has `is_platform_admin = true`.
2. Open **Backoffice** from the sidebar (or go to `/backoffice/tenants`).
3. Click **Novo tenant** and fill in:
   - Nome da empresa
   - Nome do administrador
   - E-mail do administrador
   - Senha do administrador
   - Limite de usuários (number; 0 or leave as needed)
   - Slug (optional; if empty, derived from company name)
4. Submit. The Edge Function creates the tenant and the first HR user. On success you are redirected to the new tenant’s detail page.

## Creating a tenant via script

For automation (CI, ops scripts), use the **provision-tenant** Edge Function with the shared secret.

### Environment variables

- **SUPABASE_URL** – Project URL (e.g. `https://xxx.supabase.co`).
- **PROVISIONING_SECRET** – Secret configured in Supabase Edge Function secrets; same value as `PROVISIONING_SECRET` in the function’s environment.

Set these in your shell or in a `.env` file in the project root (the provided script sources `.env` if present).

### Supabase: set the secret

In Supabase Dashboard: **Project Settings → Edge Functions → Secrets**, add:

- Name: `PROVISIONING_SECRET`
- Value: a long random string (e.g. generated with `openssl rand -hex 32`). Keep it secret and rotate if compromised.

### Shell script (recommended)

From the project root:

```bash
chmod +x scripts/provision-tenant.sh
./scripts/provision-tenant.sh "Company Name" "Admin Full Name" "admin@company.com" "SecurePassword" 100
```

Optional 6th argument: slug. If omitted, the function derives a unique slug from the company name.

Example with slug:

```bash
./scripts/provision-tenant.sh "Acme Corp" "Jane Admin" "jane@acme.com" "Secret123" 50 "acme"
```

### Using curl directly

```bash
curl -X POST "$SUPABASE_URL/functions/v1/provision-tenant" \
  -H "Authorization: Bearer $PROVISIONING_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Acme Corp",
    "admin_name": "Jane Admin",
    "admin_email": "jane@acme.com",
    "admin_password": "Secret123",
    "user_limit": 50
  }'
```

Optional: add `"slug": "acme"` to the JSON.

### Response

- **Success (200):** JSON with `tenant_id`, `user_id`, and `slug`. The tenant and first HR user exist; the admin can log in with the given email/password.
- **Error (4xx/5xx):** JSON with an `error` message (e.g. email already registered, slug in use).

## Backoffice pages

- **`/backoffice`** – Redirects to `/backoffice/tenants`.
- **`/backoffice/tenants`** – List of all tenants (company name, created date, user limit, current user count). Only platform admins.
- **`/backoffice/tenants/new`** – Form to create a tenant (calls the same provision-tenant function). Only platform admins.
- **`/backoffice/tenants/:tenantId`** – Tenant detail (company info, user count, limit, first HR admin). Only platform admins.

Access to these routes is enforced by the **BackofficeGuard**: the user must be authenticated and have `is_platform_admin = true`; otherwise they are redirected to `/dashboard` or `/login`. Tenant users cannot access backoffice; only platform users can.

## Security summary

- Only users with `profiles.is_platform_admin = true` can open backoffice routes and call the provision-tenant function with a JWT.
- Platform users keep `tenant_id` NULL; the app never assigns them a tenant (AuthContext skips `ensureProfileTenant` for platform admins).
- Tenant isolation: **TenantAccessGuard** and AuthContext ensure tenant users can only access the tenant that matches the URL slug; wrong slug redirects to login with `?reason=wrong_tenant`.
- Scripts or servers must know `PROVISIONING_SECRET` to call provision-tenant without a user session. Restrict and rotate this secret.
- RLS: tenant-scoped tables restrict access by `get_my_profile_tenant_id()`. Platform admins use SECURITY DEFINER RPCs for backoffice (e.g. `get_backoffice_tenants`); they do not get direct client access to other tenants’ data via RLS.
