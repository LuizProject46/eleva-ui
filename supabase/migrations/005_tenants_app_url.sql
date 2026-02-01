-- Migration 005: app_url para tenants (links em e-mails whitelabel)
-- Permite que cada tenant tenha uma URL base para links em e-mails (recuperação de senha, etc.)

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS app_url TEXT;

COMMENT ON COLUMN tenants.app_url IS 'URL base da aplicação para este tenant (ex: https://empresa.eleva.com). Usado em e-mails para links de ação.';
