#!/usr/bin/env bash
# Local development: Supabase (started or reused), the Spring API on :8080
# (local profile, in the background) and `pnpm dev` on :3000.
# Ctrl-C stops the API and the web app; the Supabase stack keeps running.
# Admin emails default to admin@e2e.test; override with APP_ADMIN_EMAILS=you@example.com.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/supabase-env.sh
source scripts/supabase-env.sh

(cd api && exec ./mvnw -q spring-boot:run -Dspring-boot.run.profiles=local) &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT INT TERM

echo "API starting on http://localhost:8080 (admins: $APP_ADMIN_EMAILS)"
cd web
pnpm dev
