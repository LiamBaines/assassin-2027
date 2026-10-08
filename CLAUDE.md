# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project
An app for running a real-life game of Assassin. The full design and phased build order are in `docs/architecture.md`, and the key decisions are in `docs/adr/`.

**Architecture (three tiers):**
- `web/`: Next.js, deployed on Vercel
- `api/`: Spring Boot 3.5, Java 21, Maven, deployed on Fly.io
- Supabase Postgres for data, plus Supabase Auth for magic-link login

**Rules that are easy to get wrong:**
- **The web app never touches game tables.** It uses Supabase only for auth. All game data goes through the Spring API, called server-side only (Server Components and Server Actions) with the Supabase access token as a bearer token.
- **Flyway in `api/` is the only schema source of truth.** Never create `supabase/migrations`.
  - Game tables live in Postgres schema `game`. PostgREST doesn't expose it, `anon` and `authenticated` have all grants revoked, and RLS is on with no policies.
  - `supabase db reset` wipes the `game` schema. Restart the API to re-migrate.
- **Spring validates Supabase JWTs** as ES256 via JWKS, checking issuer `${SUPABASE_URL}/auth/v1` and audience `authenticated`. `jws-algorithms: ES256` must be set explicitly. Admins are the emails in `APP_ADMIN_EMAILS`.
- **Terminology:**
  - The player hunting someone is the **assassin**, and the player being hunted is the **target**. Never use "hunter".
  - The first ring is the `INITIAL` round. Every later re-allocation is a **shakeup** (`SHAKEUP`); a reshuffle and a shakeup are the same thing.
  - A ring is a single cycle of all ALIVE players.

## Local toolchain
JDK 21 and Node 22 are Homebrew keg-only installs that aren't on the default `PATH`. Prefix commands with:
```sh
export PATH=/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/opt/node@22/bin:$PATH JAVA_HOME=/opt/homebrew/opt/openjdk@21
```
Docker is provided by **Colima**, not Docker Desktop. Start it with `colima start`. Testcontainers also needs:
```sh
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock
```

## Commands
```sh
./scripts/gen-local-signing-key.sh   # once: local ES256 key -> supabase/signing_keys.json (gitignored)
supabase start                       # local stack: API :54321, DB :54322, Mailpit :54324

# API (run from api/)
APP_ADMIN_EMAILS=you@example.com ./mvnw spring-boot:run -Dspring-boot.run.profiles=local   # :8080, needs supabase start
./mvnw test                          # unit tests only (no Docker)
./mvnw test -Dtest=RingGeneratorTest # a single test class
./mvnw verify                        # unit + *IT.java integration tests (Testcontainers postgres:17, needs Docker)
./mvnw -DskipITs verify              # build and unit tests without Docker
```
Web (`cd web`, after `cp .env.example .env.local` and `pnpm install`):
```sh
pnpm dev                              # http://localhost:3000
pnpm lint
pnpm typecheck                        # next typegen && tsc --noEmit
pnpm test                             # vitest run (all unit tests)
pnpm vitest run src/lib/api.test.ts   # single test file
pnpm build                            # needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SITE_URL, API_BASE_URL
```
Full stack and e2e (from the repo root; `scripts/supabase-env.sh` starts or reuses Supabase and exports every env var from `supabase status -o env`):
```sh
./scripts/dev.sh                     # Supabase + API (local profile, admin admin@e2e.test) + pnpm dev; Ctrl-C stops API and web
APP_ADMIN_EMAILS=you@example.com ./scripts/dev.sh
./scripts/e2e.sh                     # Playwright: starts API + `pnpm build && pnpm start` itself, reuses ones already on :8080/:3000
./scripts/e2e.sh e2e/full-flow.spec.ts                 # a single spec through the script
cd web && pnpm exec playwright test e2e/full-flow.spec.ts   # a single spec, if the env from supabase-env.sh is already exported
```
**E2E notes:**
- Specs live in `web/e2e/` and run serially with 1 worker, because they share one live game.
- Global setup truncates every `game.*` table except `flyway_schema_history`, connecting straight to the DB (`E2E_DATABASE_URL`). It never goes through the API.
- It logs in admin@e2e.test and player1..3@e2e.test with `auth.admin.generateLink({type:'magiclink'})` and `/auth/confirm?type=email`, then saves cookies to `web/e2e/.auth/` (gitignored).
- `generateLink` reports `signup` for new users. `verifyOtp` with type `email` accepts both.
- Reuse is off under `CI=1`. A stale server already on :3000 or :8080 (wrong env, old build) is reused locally, so stop it first.
- CI (`.github/workflows/`): `api.yml` (`mvnw verify`), `web.yml` (lint, typecheck, test, build) and `e2e.yml` (`scripts/e2e.sh`, uploads the report on failure).
- If `supabase start` fails with `docker-credential-desktop: executable file not found`, `~/.docker/config.json` still has Docker Desktop's `"credsStore": "desktop"`. Remove that line, or point `DOCKER_CONFIG` at a copy without it.

**API layout:** `com.assassin.api.{config,common,game,player,targeting}`. ITs extend `IntegrationTest`, which shares one context and truncates the game tables before each test. They mint real ES256 tokens with `JwtTestSupport`.

**Web notes:**
- Next 16, so the middleware file is `src/proxy.ts` (exports `proxy`).
- `cacheComponents` is off on purpose, so `redirect()`/`notFound()` give real status codes.
- All Spring calls go through `src/lib/api.ts` (server-only).
- Admin pages must call `requireAdmin()` themselves. Layouts render concurrently with pages, so a layout-only gate does not stop the page's admin fetches.
- No round yet means `expectedCurrentRoundNo: null`, and `GET /api/admin/rings/current` is 404 `NO_RING` (`getCurrentRing()` returns null).
- Error `code` to message maps live in `src/app/admin/actions.ts` and `src/app/join/actions.ts`; unknown codes fall back to the API `detail`.

## Progress log
- 2026-10-07: Toolchain installed via Homebrew. Supabase local config (`supabase/config.toml`) is set up: site_url localhost:3000, ES256 signing key, magic_link template, `email_sent` rate limit raised to 100. Docs and ADRs written. (Build order step 0)
- 2026-10-08: API steps 1-10 on `feat/api`: skeleton (Boot 3.5.16, hand-written pom; Initializr no longer offers 3.5.x), V1 schema + lockdown, ES256 JWT security with admin allowlist, ProblemDetail errors, admin game/players/rings, signup, RingGenerator, RingService, `/api/me/target`. Unit tests pass; the Testcontainers ITs have not run yet because Docker was down. 
- 2026-10-08: Web tier on `feat/web` (Next 16.4, @supabase/ssr 0.12, Vitest 5). Scaffold, Supabase SSR auth (login via Server Actions, `/auth/confirm`, proxy gating with `getClaims()`, sign-out), `lib/api.ts` with unit tests, player pages and admin pages. Lint, typecheck, tests and build pass; not yet run against the real API. (Build order steps 11–15)
- 2026-10-08: Both branches merged into `feat/mvp`.
- Decision (2026-10-08): removing a player mid-game **splices them out of the ring**. Their assassin inherits their target, the same way a kill will work. This replaced the plan's `IN_ACTIVE_RING` block, which left no way to remove anyone once the game was ACTIVE. Details are in `docs/architecture.md` (Decisions).
- 2026-10-08: Contract alignment on `feat/mvp`. Ring POST and `GET /rings/current` now return `{roundId, roundNo, reason, ring}`, and `current` is 404 `NO_RING` before the first round. History rows include `roundId`. The web handles no live game on the players and rings pages, and maps `GAME_FINISHED`, `CONCURRENT_UPDATE`, `INVALID_STATUS`, `PLAYER_NOT_FOUND` and `EMAIL_REQUIRED`. Splice removal is implemented as `RingService.spliceOut` (source `SPLICE`, added to V1), and `IN_ACTIVE_RING` is gone. `-DskipITs verify` and all web checks pass. The ITs compile but have still never run, because Docker was down.
- 2026-10-08: Docker Desktop replaced with Colima. First real IT run found that V1 hung forever: it ran `ALTER` on `game.flyway_schema_history`, which Flyway locks while migrating. That table is now left alone; the revoked schema USAGE still protects it. `./mvnw verify` passes: 12 unit tests and 56 ITs.
- 2026-10-08: Steps 16–17 on `feat/mvp`. First full-stack run (Supabase CLI 2.120, Spring, Next prod build, Playwright 1.63 Chromium).
  - JWT setup checked by hand: the JWKS serves one ES256 EC key, and a real token's `iss` is `http://127.0.0.1:54321/auth/v1` with `aud` `authenticated`, which matches the Spring validator. The type pairing (`generateLink` magiclink/signup, verified with `type=email`) works as-is.
  - Cross-tier bugs found and fixed:
    - The security filter chain answered 401/403 with empty bodies, so the web saw `HTTP_403` with no `code`. They are now ProblemDetail bodies (`UNAUTHORIZED`/`FORBIDDEN`) that keep the RFC 6750 `WWW-Authenticate` header (`ProblemDetailSecurityErrors`).
    - Next renders `admin/layout.tsx` and the page concurrently, so a non-admin on `/admin` still triggered admin API calls, and therefore unhandled 403s, behind the layout's `notFound()`. Every admin page now calls `requireAdmin()`, and `getMe` is wrapped in React `cache()`.
  - Both e2e failures along the way were spec selector issues: Next's route announcer is also `role=alert`, and a display name also appears as another row's target.
  - 16 specs pass: magic link (link and code), the full flow, and the lockdown spec (PGRST106 for `game`).
  - The CI workflows pass action-validator but have not yet run on GitHub.
- 2026-10-08: Review fixes. Wrong join codes are limited to 5 per account per 10 minutes (429 `TOO_MANY_ATTEMPTS`), using the in-memory `JoinCodeAttemptLimiter` instead of Bucket4j. Display names are measured in code points, so an emoji counts as one character, and control or zero-width characters are rejected (`INVALID_DISPLAY_NAME`). A signup constraint race now maps to the exact constraint. PR #1 is open (feat/mvp → main); deploy (step 18) is next.
- 2026-10-08: PR #1 merged, and CI (api, web, e2e) passed on GitHub. Step 18 started on `chore/deploy`.
  - Added `api/Dockerfile` and `api/fly.toml`: app `assassin-2027-api`, region `fra` (next to Supabase eu-central-1), one always-on 512 MB machine, Hikari pool of 5.
  - The image was checked against local Supabase. It migrates, `/actuator/health` is UP, and `/api/me` returns 200 with a real token and 401 without one.
  - The Fly app is created but not deployed yet.
  - Decision: prod email goes out through **Gmail SMTP with an app password** (`smtp.gmail.com:465`, about 500 emails a day), because there is no owned domain for Resend. Supabase locks template editing until custom SMTP is configured, and the default template's link doesn't work with `/auth/confirm`, so SMTP blocks prod login.
  - **Deployed.** The API is at https://assassin-2027-api.fly.dev and V1 migrated on prod through the session pooler (`aws-1-eu-central-1`, user `postgres.fujwiyboxugxbnlaxfyn`). The web is at https://assassin-2027.vercel.app.
    - Vercel project `assassin-2027`: Root Directory `web`, Node 22, env set for production only.
    - Vercel GitHub auto-deploy is not connected yet, because the Vercel account has no GitHub login connection. Deploy from the repo root with `npx vercel deploy --prod`.
    - Prod JWKS serves ES256 P-256.
    - The publishable key gets PGRST002 (503) on PostgREST, with the Data API off.
    - Fly config in `fly.toml`. Secrets: datasource URL/user/password, `SUPABASE_URL`, `APP_ADMIN_EMAILS`.
  - Prod Supabase must have **Confirm email turned off**, to match local `enable_confirmations = false`. Otherwise new users get the "Confirm signup" email instead of the token_hash magic link.
