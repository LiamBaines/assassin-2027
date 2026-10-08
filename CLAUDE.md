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
Docker must be running for Testcontainers and `supabase start`.

## Commands
```sh
./scripts/gen-local-signing-key.sh   # once: local ES256 key -> supabase/signing_keys.json (gitignored)
supabase start                       # local stack: API :54321, DB :54322, Mailpit :54324
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
Add the API and e2e commands here as those tiers are built.

**Web notes:** Next 16, so the middleware file is `src/proxy.ts` (exports `proxy`). `cacheComponents` is off on purpose, so `redirect()`/`notFound()` give real status codes. All Spring calls go through `src/lib/api.ts` (server-only). No round yet means `expectedCurrentRoundNo: 0`.

## Progress log
- 2026-10-07: Toolchain installed via Homebrew. Supabase local config (`supabase/config.toml`) is set up: site_url localhost:3000, ES256 signing key, magic_link template, `email_sent` rate limit raised to 100. Docs and ADRs written. (Build order step 0)
- 2026-10-08: Web tier on `feat/web` (Next 16.4, @supabase/ssr 0.12, Vitest 5). Scaffold, Supabase SSR auth (login via Server Actions, `/auth/confirm`, proxy gating with `getClaims()`, sign-out), `lib/api.ts` with unit tests, player pages and admin pages. Lint, typecheck, tests and build pass; not yet run against the real API. (Build order steps 11–15)
