#!/usr/bin/env bash
# Sourced by dev.sh and e2e.sh: starts (or reuses) the local Supabase stack and
# exports the env vars the API and web app need, read from `supabase status`.
# Expects the repo root as the working directory.

if ! supabase status >/dev/null 2>&1; then
  supabase start
fi

_supabase_status="$(supabase status -o env)"
_status_value() {
  local value
  value="$(printf '%s\n' "$_supabase_status" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}\$/\1/p")"
  if [[ -z "$value" ]]; then
    echo "supabase status did not report $1" >&2
    return 1
  fi
  printf '%s' "$value"
}

_api_url="$(_status_value API_URL)"

# Spring API
export SUPABASE_URL="$_api_url"
export SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:54322/postgres"
export SPRING_DATASOURCE_USERNAME=postgres
export SPRING_DATASOURCE_PASSWORD=postgres
export APP_ADMIN_EMAILS="${APP_ADMIN_EMAILS:-admin@e2e.test}"

# Web app
export NEXT_PUBLIC_SUPABASE_URL="$_api_url"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(_status_value PUBLISHABLE_KEY)"
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
export API_BASE_URL=http://localhost:8080

# e2e only: never set these on Vercel.
export SUPABASE_SECRET_KEY="$(_status_value SECRET_KEY)"
export MAILPIT_URL="$(_status_value MAILPIT_URL)"
export E2E_DATABASE_URL="$(_status_value DB_URL)"

unset _supabase_status _api_url
unset -f _status_value
