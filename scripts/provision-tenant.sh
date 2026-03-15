#!/usr/bin/env bash
# Provision a new tenant via the provision-tenant Edge Function.
# Requires: SUPABASE_URL, PROVISIONING_SECRET (env or .env).
# Usage: ./scripts/provision-tenant.sh "Company Name" "Admin Name" "admin@company.com" "password" 100 [slug]

set -e

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

SUPABASE_URL="${SUPABASE_URL:?Set SUPABASE_URL (e.g. https://xxx.supabase.co)}"
PROVISIONING_SECRET="${PROVISIONING_SECRET:?Set PROVISIONING_SECRET (same as in Supabase Edge Function secrets)}"

COMPANY_NAME="${1:?Usage: $0 \"Company Name\" \"Admin Name\" \"admin@company.com\" \"password\" user_limit [slug]}"
ADMIN_NAME="${2:?}"
ADMIN_EMAIL="${3:?}"
ADMIN_PASSWORD="${4:?}"
USER_LIMIT="${5:?}"
SLUG="${6:-}"

if [ -n "$SLUG" ]; then
  BODY=$(jq -n \
    --arg company_name "$COMPANY_NAME" \
    --arg admin_name "$ADMIN_NAME" \
    --arg admin_email "$ADMIN_EMAIL" \
    --arg admin_password "$ADMIN_PASSWORD" \
    --argjson user_limit "$USER_LIMIT" \
    --arg slug "$SLUG" \
    '{ company_name: $company_name, admin_name: $admin_name, admin_email: $admin_email, admin_password: $admin_password, user_limit: $user_limit, slug: $slug }')
else
  BODY=$(jq -n \
    --arg company_name "$COMPANY_NAME" \
    --arg admin_name "$ADMIN_NAME" \
    --arg admin_email "$ADMIN_EMAIL" \
    --arg admin_password "$ADMIN_PASSWORD" \
    --argjson user_limit "$USER_LIMIT" \
    '{ company_name: $company_name, admin_name: $admin_name, admin_email: $admin_email, admin_password: $admin_password, user_limit: $user_limit }')
fi

RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $PROVISIONING_SECRET" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "$SUPABASE_URL/functions/v1/provision-tenant")

HTTP_CODE=$(echo "$RESP" | tail -n1)
BODY_ONLY=$(echo "$RESP" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "$BODY_ONLY" | jq .
  echo "Tenant provisioned successfully."
else
  echo "Error ($HTTP_CODE): $BODY_ONLY" >&2
  exit 1
fi
