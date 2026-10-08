#!/usr/bin/env bash
# Runs the Playwright e2e specs against the full local stack:
# Supabase (started or reused), the Spring API (local profile) and `next build && next start`.
# Playwright's webServer config starts the API and web app; this script provides their env.
# Extra arguments go to `playwright test`, e.g. ./scripts/e2e.sh e2e/full-flow.spec.ts
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/supabase-env.sh
source scripts/supabase-env.sh

cd web
exec pnpm exec playwright test "$@"
