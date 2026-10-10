# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project
An app for running a real-life game of Assassin. The full design and phased build order are in `docs/architecture.md`, and the key decisions are in `docs/adr/`.

Other docs, read only when relevant: `docs/progress.md` (build history and decisions log; append new entries there), `docs/e2e.md` (e2e test internals), `docs/deploy.md` (prod setup runbook).

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
  - A **round** is a game-level stage (1, 2, 3...). Players are revived and re-picked when the admin starts a new one. Within a round, the first **allocation** is `INITIAL` and every later one is a **shakeup** (`SHAKEUP`); a reshuffle and a shakeup are the same thing. Don't call an allocation a round.
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
E2E details (serial specs, DB truncation, auth setup, stale-server gotcha, CI) are in `docs/e2e.md`.

**API layout:** `com.assassin.api.{config,common,game,player,targeting}`. ITs extend `IntegrationTest`, which shares one context and truncates the game tables before each test. They mint real ES256 tokens with `JwtTestSupport`.

**Web notes:**
- Next 16, so the middleware file is `src/proxy.ts` (exports `proxy`).
- `cacheComponents` is off on purpose, so `redirect()`/`notFound()` give real status codes.
- All Spring calls go through `src/lib/api.ts` (server-only).
- Admin pages must call `requireAdmin()` themselves. Layouts render concurrently with pages, so a layout-only gate does not stop the page's admin fetches.
- Games are scoped by id in every route: `/api/admin/games/{gameId}/…` and `/api/me/games/{gameId}/target` (ADR 0003). There is no "current game".
- No allocation yet means `expectedCurrentRoundNo: null`, and `GET /api/admin/games/{gameId}/rings/current` is 404 `NO_RING` (`getCurrentRing(gameId)` returns null).
- Logged-out visitors go to `/login?next=…`. Every return path goes through `safeNextPath` (`lib/safe-next.ts`). It re-checks the path after dot segments resolve, because `/.//evil.com` turns into `//evil.com`.
- The magic-link template passes `{{ .RedirectTo }}` as `redirect_to`. The prod dashboard template must match `supabase/templates/magic_link.html`.
- Error `code` to message maps live in `src/app/admin/actions.ts` and `src/app/join/actions.ts`; unknown codes fall back to the API `detail`.
