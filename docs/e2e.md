# E2E notes

Playwright specs live in `web/e2e/`. Run them with `./scripts/e2e.sh` (see `CLAUDE.md` for the commands).

- Specs run serially with 1 worker, because they share one live game.
- Global setup truncates every `game.*` table except `flyway_schema_history`, connecting straight to the DB (`E2E_DATABASE_URL`). It never goes through the API.
- It logs in admin@e2e.test and player1..3@e2e.test with `auth.admin.generateLink({type:'magiclink'})` and `/auth/confirm?type=email`, then saves cookies to `web/e2e/.auth/` (gitignored).
- `generateLink` reports `signup` for new users. `verifyOtp` with type `email` accepts both.
- Reuse is off under `CI=1`. A stale server already on :3000 or :8080 (wrong env, old build) is reused locally, so stop it first.
- CI (`.github/workflows/`): `api.yml` (`mvnw verify`, then on push to main `flyctl deploy`), `web.yml` (lint, typecheck, test, build) and `e2e.yml` (`scripts/e2e.sh`, uploads the report on failure).
- If `supabase start` fails with `docker-credential-desktop: executable file not found`, `~/.docker/config.json` still has Docker Desktop's `"credsStore": "desktop"`. Remove that line, or point `DOCKER_CONFIG` at a copy without it.
