-- Migration 068: Per-tenant user limit for pricing/plan support
-- NULL = unlimited (backward compatible).

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_users INTEGER NULL;

COMMENT ON COLUMN tenants.max_users IS 'Maximum active users for this tenant; NULL = unlimited. Used for pricing/plan limits.';
