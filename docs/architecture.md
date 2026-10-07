# Assassin 2027: architecture and MVP plan

## Context
The user is running a real-life game of Assassin. In the game, each player hunts an assigned target. A player who kills their target inherits that target's target, and the last player standing wins. The goal is an app that automates the game. The repo is currently empty: a stub CLAUDE.md, an empty `docs/`, and no commits.

Long-term features, out of scope here:
- kill log, leaderboard and statuses
- anonymous messaging
- gallery
- NFC kill confirmation
- reference material

**This MVP covers:**
- player signup
- an admin console that allocates targets
- persistence
- a minimal player page showing the current target

The schema and architecture must not block the later features.

## Decisions (agreed with user)
- **Three tiers:**
  - Next.js front end (TypeScript, App Router, Tailwind, pnpm) on **Vercel**
  - **Spring Boot 3.5 / Java 21 / Maven** API on **Fly.io** (Docker)
  - **Supabase Postgres** for data
- **Auth:**
  - Supabase **email magic link** on the front end, using a `token_hash` link plus a 6-digit code fallback.
  - Spring validates Supabase JWTs as an OAuth2 resource server. It uses ES256 via JWKS at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, with `jws-algorithms: ES256` set explicitly and custom validators for issuer and audience (`authenticated`).
- **The front end never touches game tables.** Next.js calls Spring server-side only, from Server Components and Actions, with `Authorization: Bearer <access token>`. This means no CORS, and `API_BASE_URL` stays server-only.
- **Admins** come from the `APP_ADMIN_EMAILS` env allowlist in Spring and get `ROLE_ADMIN`. The web app learns admin status only from `GET /api/me`. **An admin may also register as a player.**
- **Signup** collects a display name (2–32 chars, unique per game, case-insensitive) and the **join code** set by the admin.
- **Targeting:** **auto ring only**. One button shuffles all ALIVE players into a single cycle. The first run is the initial allocation. Every later run is a **shakeup**, which replaces the active assignments while keeping history. (A reshuffle and a shakeup are the same thing.)
- **Terminology:** a player hunting someone is the **assassin**, and the player being hunted is the **target**. Use these names in the code, the schema and the UI.
- **Signups are not auto-closed** when the ring is generated. The admin toggles them manually, and late joiners have no target until the next shakeup.
- **Removing a player** who is in an active ring while the game is ACTIVE returns 409 `IN_ACTIVE_RING`, and the admin must run a shakeup instead. Proper removal from the ring comes with kill logic later.
- **Scale:** under 200 players, one live game at a time. A `game` table is kept anyway for future-proofing.
- **Flyway (in Spring) is the only schema source of truth.**
  - `/supabase` holds auth config only. There is never a `supabase/migrations` dir.
  - Game tables live in a dedicated **`game` schema**. PostgREST doesn't expose it, `anon` and `authenticated` have all grants revoked, and RLS is on with no policies.
  - The production Data API is disabled.

## Repo layout
```
/api        Spring Boot (mvnw, Dockerfile, fly.toml)
            com.assassin.api.{config,common,game,player,targeting}
            resources/db/migration/V1__init.sql
/web        Next.js (src/app, src/lib/supabase, src/lib/api.ts, src/proxy.ts, e2e/)
/supabase   config.toml, templates/magic_link.html, signing_keys.json (gitignored, local)
/scripts    dev.sh, e2e.sh, gen-local-signing-key.sh
/docs       architecture.md, adr/
/.github/workflows  api.yml, web.yml, e2e.yml
```

## Data model (`V1__init.sql`, schema `game`)
- `game`: id uuid, name, join_code (uppercase `^[A-Z0-9]{6,16}$`), status (`SETUP|ACTIVE|FINISHED`), signups_open, created_at/started_at/finished_at, version. A partial unique index allows only one non-FINISHED game.
- `player`: id, game_id FK, auth_user_id (JWT `sub`, no FK to auth.users), email, display_name, status (`ALIVE|DEAD|REMOVED`), joined_at. Unique on `(game_id, auth_user_id)` and `(game_id, lower(display_name))`, plus `(id, game_id)` as the target for composite FKs.
- `assignment_round`: id, game_id, round_no (unique per game), reason (`INITIAL|SHAKEUP`), player_count, created_by, created_at.
- `assignment`: id identity, game_id, round_id, assassin_id, target_id (composite FKs to player), source (`RING|KILL_INHERIT|MANUAL`), status (`ACTIVE|COMPLETED|SUPERSEDED|VOIDED`), created_at, ended_at.
  - Check: `assassin <> target`.
  - Partial unique indexes keep one ACTIVE row per assassin and one ACTIVE row per target (one assassin per target).
- RLS is enabled on every table. A guarded `DO` block revokes grants from `anon` and `authenticated` only when those roles exist, so the migration also runs on plain Postgres in Testcontainers.
- Enum-like values are stored as `text` with CHECK constraints. JPA runs with `ddl-auto=validate` and `default_schema=game`.
- **How future features fit:**
  - kill log: a `kill` table referencing an assignment
  - shakeups are already in the MVP: each one is a new round with reason `SHAKEUP`
  - messaging: keyed by assignment, so the assassin stays anonymous
  - gallery: Storage with signed URLs from Spring

## API (Spring, `/api`, ProblemDetail errors with a `code` property)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/actuator/health` | public | Fly health check |
| GET | `/api/me` | user | `{email, isAdmin, game, player}` |
| POST | `/api/players` | user | `{displayName, joinCode}`. Errors: `NO_LIVE_GAME`, `SIGNUPS_CLOSED`, `BAD_JOIN_CODE`, `ALREADY_REGISTERED`, `NAME_TAKEN` |
| GET | `/api/me/target` | user | `{target:{displayName}, assignedAt}` or 404 `NO_TARGET` |
| GET/POST/PATCH | `/api/admin/game` | admin | Create (`LIVE_GAME_EXISTS`), or edit name, code, signupsOpen, or FINISHED |
| GET | `/api/admin/players` | admin | Includes each player's current target |
| PATCH | `/api/admin/players/{id}` | admin | REMOVED or ALIVE. Returns 409 `IN_ACTIVE_RING` when the game is ACTIVE and the player has an active assignment |
| POST | `/api/admin/rings` | admin | `{expectedCurrentRoundNo}`. Errors: `NOT_ENOUGH_PLAYERS` (<2), `STALE_ROUND`, `GAME_FINISHED` |
| GET | `/api/admin/rings/current`, `/api/admin/rings` | admin | Current ring in cycle order, and round history |

## Ring assignment
- **`RingGenerator`** (pure function): runs a Fisher-Yates shuffle with an injected `RandomGenerator` (`SecureRandom` in prod), then emits pairs `p[i] → p[(i+1)%n]`. The result is always one cycle with no self-targets, and every cycle is equally likely.
- **`RingService.shuffle`** runs as one `@Transactional` operation:
  1. `SELECT … FROM game.game WHERE status <> 'FINISHED' FOR UPDATE`.
  2. Check `expectedCurrentRoundNo`.
  3. Load ALIVE players. Fail if there are fewer than 2.
  4. Run a single `UPDATE` that marks ACTIVE assignments SUPERSEDED.
  5. Insert the round (`INITIAL` or `SHAKEUP`).
  6. Batch-insert the n assignments.
  7. If the game is in SETUP, set it to ACTIVE and set `started_at`.

## Front end
- **Player (mobile-first):**
  - `/`: routes on `/api/me`
  - `/login`: email form, then code entry
  - `/auth/confirm`: route handler that calls `verifyOtp`
  - `/join`
  - `/me`: status and sign-out
  - `/target`
- **Admin (desktop):** `admin/layout.tsx` calls `/api/me` and returns `notFound()` unless `isAdmin`.
  - `/admin`: create or edit the game, toggle signups, finish
  - `/admin/players`: table with remove/restore
  - `/admin/rings`: generate ring / shake up with a confirm dialog, the current ring, and history
- `src/proxy.ts` refreshes the `@supabase/ssr` session. `lib/api.ts` is server-only, maps ProblemDetail `code` to typed errors, and redirects to `/login` on a 401.

## Config
- **API (Fly secrets):**
  - `SPRING_DATASOURCE_URL/USERNAME/PASSWORD`: the Supabase **session pooler** on 5432, which is IPv4. Not transaction mode.
  - `SUPABASE_URL`, `APP_JWT_AUDIENCE=authenticated`, `APP_ADMIN_EMAILS`, `SPRING_PROFILES_ACTIVE=prod`
  - Local: `127.0.0.1:54322` postgres/postgres, and `SUPABASE_URL=http://127.0.0.1:54321`
- **Web (Vercel):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, and `API_BASE_URL` (server-only). The e2e-only vars `SUPABASE_SECRET_KEY` and `MAILPIT_URL` are never set on Vercel.
- **Supabase `config.toml`:** site_url and redirect URLs, the magic_link template, `[auth.rate_limit] email_sent` raised for e2e, and `signing_keys_path` with a local ES256 key so local matches prod. Production needs custom SMTP.

## Build order (one commit per step, on feature branches)
0. Scaffold: `.gitignore`, README, `docs/architecture.md`, ADRs, CLAUDE.md commands and layout, `supabase init` and config, signing key script.
1. API skeleton (Initializr deps: web, security, oauth2-resource-server, data-jpa, validation, flyway, postgresql, actuator, testcontainers) and a context-load IT.
2. `V1__init.sql`, entities and repos, lockdown IT.
3. Security: decoder, admin converter, filter chain, `JwtTestSupport`, 401/403 ITs.
4. ProblemDetail handler and `/api/me`.
5. Admin game endpoints.
6. Signup endpoint.
7. `RingGenerator` and property tests.
8. `RingService`, ring endpoints, concurrency ITs.
9. Admin players endpoints.
10. `/api/me/target`.
11. Web scaffold (create-next-app, Vitest).
12. Supabase SSR auth: login, confirm, proxy, sign-out.
13. `lib/api.ts`.
14. `/`, `/join`, `/me`, `/target`.
15. Admin pages: game, players, rings.
16. Playwright and `scripts/e2e.sh`, plus the e2e specs.
17. GitHub Actions CI.
18. Deploy: Dockerfile and `fly.toml` (`min_machines_running=1`, region matched to Supabase), Supabase prod setup (asymmetric keys, SMTP, redirects, Data API off), Vercel, then a prod smoke test.

## Verification
- **API, `cd api && ./mvnw verify`** (needs Docker, runs Testcontainers Postgres 17). A single test runs with `./mvnw test -Dtest=RingGeneratorTest`.
  - **RingGenerator property tests:** for n in 2..200 across many seeds, check for a single n-cycle, no self-targets, and each player appearing once as assassin and once as target. Add a uniformity check for n=4.
  - **Ring ITs:**
    - fewer than 2 players returns 409
    - the first shuffle creates round 1 and makes the game ACTIVE
    - a shakeup supersedes the old rows and keeps history
    - DEAD and REMOVED players are excluded
    - `STALE_ROUND`
    - two concurrent shuffles: exactly one succeeds
  - **Security ITs** use real ES256 tokens from a test key: missing, bad issuer, bad audience or expired returns 401; a non-admin on admin routes gets 403; an allowlisted email in mixed case is accepted.
  - **Signup ITs** cover every error code and case-insensitive join codes.
  - **Lockdown IT:** `anon` has no USAGE on `game`, and RLS is on for every table.
- **Web:**
  - `pnpm lint && pnpm tsc --noEmit && pnpm vitest run`
  - **Playwright** via `scripts/e2e.sh`, which runs `supabase start`, Spring with the local profile, and `next build && next start`.
    - A real magic-link spec reads the email from Mailpit (`:54324`) using both the link and the code.
    - Other specs log in through `auth.admin.generateLink` with the local secret key, which needs no backdoor in production code.
    - **Full flow:** the admin creates game `TEST42`, a wrong join code is rejected, 3 players join, the admin generates a ring that forms a cycle, each player's `/target` matches the ring, a shakeup shows round 2, and a non-admin gets 404 on `/admin`.
    - **Lockdown spec:** the publishable key gets no access to schema `game` through PostgREST.
- **Prod smoke test:** log in, create a game, join with two accounts, shuffle, and check both target pages.

## Risks and notes
- Supabase's built-in SMTP is heavily rate-limited, so **custom SMTP is required** before real signups.
- Without `jws-algorithms: ES256`, every token is rejected. The security ITs guard against this.
- Fly must connect through the Supabase session pooler. The direct host is IPv6-only.
- Supabase free projects pause after about 7 days idle.
- Join codes are at least 6 characters. Add a simple in-memory rate limit (Bucket4j) on `POST /api/players`.
- `supabase db reset` wipes the Flyway schema. Restart the API to re-migrate (document this in CLAUDE.md).
