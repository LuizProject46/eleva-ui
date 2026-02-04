# Auth email templates

Authentication emails (invite, password recovery, password changed, and generic actions) are sent by the **send-email** Edge Function, which loads HTML templates and injects whitelabel branding at render time.

## Where templates live

- **Path:** `supabase/functions/send-email/templates/`
- **Files:**
  - `invite.html` – User invite
  - `recovery.html` – Password reset
  - `password_changed_notification.html` – Password changed notification
  - `generic.html` – Other actions (magic link, signup, email change, reauthentication)

Templates are deployed with the function so they can be read at runtime. The same paths are referenced in `supabase/config.toml` for local Auth / documentation.

## Placeholders

The function replaces `{{key}}` with values from the current tenant and payload. Use only these keys:

| Placeholder         | Description                    | Fallback      |
|--------------------|--------------------------------|---------------|
| `{{company_name}}`  | Tenant company name            | Eleva         |
| `{{logo_html}}`     | Pre-rendered logo (img or div)  | Injected      |
| `{{primary_color}}` | Brand primary color (hex)       | #2d7a4a       |
| `{{action_url}}`    | Confirmation / reset URL        | From payload  |
| `{{email}}`         | User email                     | From payload  |
| `{{token}}`         | OTP (recovery only)            | From payload  |
| `{{app_url}}`       | Tenant app URL                 | site_url      |

**Generic template only:**

| Placeholder    | Description        |
|----------------|--------------------|
| `{{heading}}`  | Email heading      |
| `{{body}}`     | Short body text    |
| `{{cta_text}}` | Button label       |
| `{{token_block}}` | Optional token HTML block |

Unknown placeholders are replaced with an empty string.

## How to customize

1. Edit the `.html` file in `supabase/functions/send-email/templates/`.
2. Keep **email-safe HTML**: semantic structure, **inline CSS** only, **no JavaScript**.
3. Use the placeholders above; do not introduce new ones without updating the function.
4. Redeploy the **send-email** function so the new template is bundled.

Visual consistency with the platform is preserved by reusing the same layout (outer wrapper, inner card, logo block, footer “{{company_name}} – Plataforma de RH”).

## Branding

Branding is **injected at render time** from the tenant:

- The function resolves the user’s tenant via `profiles.tenant_id` → `tenants`.
- It uses `company_name`, `logo_url`, `primary_color`, `accent_color`, `app_url` from the `tenants` table.
- `parseTenantToBranding` in `_templates/branding.ts` builds the branding object; missing or invalid values use safe defaults (e.g. company name “Eleva”, primary color “#2d7a4a”).
- `{{logo_html}}` is built by the function: if `logo_url` is set, it’s an `<img>`; otherwise a styled `<div>` with the company name.

## config.toml

In `supabase/config.toml`, `content_path` and `subject` are set for:

- `[auth.email.template.invite]`
- `[auth.email.template.recovery]`
- `[auth.email.notification.password_changed]`

Paths are relative to the **project root**. When the **Send Email** webhook is configured, Supabase Auth calls the Edge Function; the function loads templates from its own bundle (`./templates/` inside the function). The config entries document intent and apply when Supabase sends emails without the hook (e.g. local Inbucket).

## Subjects

Subjects are defined in the send-email function (`ACTION_SUBJECTS`) and include the company name (e.g. “Redefinir senha - {{company_name}}”). They remain configurable there; config.toml subjects are for reference / local Auth.
