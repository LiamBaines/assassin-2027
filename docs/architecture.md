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
- **Removing a player** mid-game **splices them out of the ring** (decided 2026-10-08, replacing an earlier `IN_ACTIVE_RING` block). In one transaction that holds the game row lock: their two active assignments A→X and X→T become `VOIDED`, and A→T is inserted in the same round with source `SPLICE`. In a two-player ring (A = T) nothing is inserted and A is left without a target. A player with no active assignment just changes status. A restored player has no target until the next shakeup. `RingService.spliceOut` is meant to be reused by kill logic.
- **Multiple games** (decided 2026-10-08, see ADR 0003): the admin can run several games at once and still sees FINISHED ones, which are read-only. One account can play in several games. A game's join code is unique among games that aren't FINISHED, and players join through a `/join/CODE` link.
- **Scale:** under 200 players per game.
- **Flyway (in Spring) is the only schema source of truth.**
  - `/supabase` holds auth config only. There is never a `supabase/migrations` dir.
  - Game tables live in a dedicated **`game` schema**. PostgREST doesn't expose it, `anon` and `authenticated` have all grants revoked, and RLS is on with no policies.
  - The production Data API is disabled.

## Repo layout
```
/api        Spring Boot (mvnw, Dockerfile, fly.toml)
            com.assassin.api.{config,common,game,player,targeting}
            resources/db/migration/V1__init.sql, V2__multi_game.sql
/web        Next.js (src/app, src/lib/supabase, src/lib/api.ts, src/proxy.ts, e2e/)
/supabase   config.toml, templates/magic_link.html, signing_keys.json (gitignored, local)
/scripts    dev.sh, e2e.sh, gen-local-signing-key.sh
/docs       architecture.md, adr/
/.github/workflows  api.yml, web.yml, e2e.yml
```

## Data model (`V1__init.sql` + `V2__multi_game.sql`, schema `game`)
- `game`: id uuid, name, join_code (uppercase `^[A-Z0-9]{6,16}$`), status (`SETUP|ACTIVE|FINISHED`), signups_open, created_at/started_at/finished_at, version. The partial unique index `game_join_code_live_uq` makes join_code unique among non-FINISHED games (V2 replaced V1's one-live-game index).
- `player`: id, game_id FK, auth_user_id (JWT `sub`, no FK to auth.users), email, display_name, status (`ALIVE|DEAD|REMOVED`), joined_at. Unique on `(game_id, auth_user_id)` and `(game_id, lower(display_name))`, plus `(id, game_id)` as the target for composite FKs.
- `assignment_round`: id, game_id, round_no (unique per game), reason (`INITIAL|SHAKEUP`), player_count, created_by, created_at.
- `assignment`: id identity, game_id, round_id, assassin_id, target_id (composite FKs to player), source (`RING|KILL_INHERIT|SPLICE|MANUAL`; `SPLICE` is an assassin inheriting a removed player's target), status (`ACTIVE|COMPLETED|SUPERSEDED|VOIDED`), created_at, ended_at.
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
Any write can also fail with 409 `CONCURRENT_UPDATE` (optimistic lock) or 400 `VALIDATION_FAILED`. Game-scoped admin routes return 404 `GAME_NOT_FOUND` for an unknown game, and every admin write to a FINISHED game returns 409 `GAME_FINISHED`. Wrong join codes (preview and signup together) are limited to 5 per account per 10 minutes, then 429 `TOO_MANY_ATTEMPTS`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/actuator/health` | public | Fly health check |
| GET | `/api/me` | user | `{email, isAdmin, games:[{game:{id,name,status,signupsOpen}, player:{id,displayName,status,joinedAt}}]}`: every game the caller plays in, FINISHED included, newest join first |
| GET | `/api/join/{code}` | user | Join preview for the non-FINISHED game with that code: `{gameId, name, status, signupsOpen, alreadyJoined}`. 404 `BAD_JOIN_CODE` (counts as a wrong code) |
| POST | `/api/players` | user | `{joinCode, displayName}`, 201 `{game, player}`. Errors: `BAD_JOIN_CODE`, `SIGNUPS_CLOSED`, `ALREADY_REGISTERED`, `NAME_TAKEN`, `INVALID_DISPLAY_NAME`, `EMAIL_REQUIRED`, `TOO_MANY_ATTEMPTS` |
| GET | `/api/me/games/{gameId}/target` | user | `{target:{displayName}, assignedAt}` or 404 `NO_TARGET` |
| GET | `/api/me/games/{gameId}/players` | user | Roster of a started game, sorted by display name: `{players:[{displayName, status}]}`, status `ALIVE`/`DEAD`/`REMOVED`/`WAITING` (`WAITING` = alive with no active assignment, computed). 404 `NOT_IN_GAME` (non-member or unknown game), 404 `GAME_NOT_STARTED` (SETUP) |
| GET/POST | `/api/admin/games` | admin | List every game, newest first, as `{id, name, joinCode, status, signupsOpen, createdAt, startedAt, finishedAt, playerCount}`, or create one `{name, joinCode}` (`JOIN_CODE_TAKEN`) |
| GET/PATCH | `/api/admin/games/{gameId}` | admin | Read, or edit name, code (`JOIN_CODE_TAKEN`), signupsOpen, or FINISHED (`INVALID_STATUS` for any other status) |
| GET | `/api/admin/games/{gameId}/players` | admin | Includes each player's current target |
| PATCH | `/api/admin/games/{gameId}/players/{playerId}` | admin | `{status}`: REMOVED or ALIVE. Removing a player in the ring splices them out (see Decisions). Errors: `INVALID_STATUS`, `PLAYER_NOT_FOUND` |
| POST | `/api/admin/games/{gameId}/rings` | admin | `{expectedCurrentRoundNo}` (null before the first round). 201 with the new ring, same shape as `current`. Errors: `NOT_ENOUGH_PLAYERS` (<2), `STALE_ROUND`, `GAME_FINISHED` |
| GET | `/api/admin/games/{gameId}/rings/current` | admin | `{roundId, roundNo, reason, ring:[{assassin:{id,displayName}, target:{id,displayName}}]}` in cycle order, or 404 `NO_RING` before the first round |
| GET | `/api/admin/games/{gameId}/rings` | admin | Round history, newest first: `[{roundId, roundNo, reason, playerCount, createdBy, createdAt}]` |

## Ring assignment
- **`RingGenerator`** (pure function): runs a Fisher-Yates shuffle with an injected `RandomGenerator` (`SecureRandom` in prod), then emits pairs `p[i] → p[(i+1)%n]`. The result is always one cycle with no self-targets, and every cycle is equally likely.
- **`RingService.shuffle`** runs as one `@Transactional` operation:
  1. `SELECT … FROM game.game WHERE id = ? FOR UPDATE`, then reject a FINISHED game. Every admin write to a game takes this lock first.
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
  - `/login?next=…`: the proxy sends logged-out visitors here, keeping where they were going. Both the code login and the magic link (whose template passes `{{ .RedirectTo }}` as `redirect_to`) return them there, through `safeNextPath`
  - `/join`: a code form that goes to `/join/CODE`
  - `/join/[code]`: "Join <game>" with a display-name field
  - `/me`: the user's games
  - `/games/[gameId]`: the user's status and target in that game, plus a Players card (everyone's name and status) once the game has started. Server-rendered on load, no polling
- **Admin (desktop):** `admin/layout.tsx` calls `/api/me` and returns `notFound()` unless `isAdmin`.
  - `/admin`: every game, plus a create form
  - `/admin/games/[gameId]`: details, the shareable join link, edit, toggle signups, finish
  - `/admin/games/[gameId]/players`: table with remove/restore
  - `/admin/games/[gameId]/rings`: generate ring / shake up with a confirm dialog, the current ring, and history
  - A FINISHED game's pages show no controls.
  - Every admin page and server action calls `requireAdmin()` itself.
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
  - **Splice ITs:** removing a player from an n≥3 ring leaves one cycle of n-1 with a `SPLICE` row in the same round and the target endpoint showing the inherited target; a two-player ring leaves the assassin without a target; a player with no assignment just changes status; a restored player has no target until the next shakeup.
  - **Security ITs** use real ES256 tokens from a test key: missing, bad issuer, bad audience or expired returns 401; a non-admin on admin routes gets 403; an allowlisted email in mixed case is accepted.
  - **Signup ITs** cover every error code and case-insensitive join codes.
  - **Lockdown IT:** `anon` has no USAGE on `game`, and RLS is on for every table.
- **Web:**
  - `pnpm lint && pnpm tsc --noEmit && pnpm vitest run`
  - **Playwright** via `scripts/e2e.sh`, which runs `supabase start`, Spring with the local profile, and `next build && next start`.
    - A real magic-link spec reads the email from Mailpit (`:54324`) using both the link and the code.
    - Other specs log in through `auth.admin.generateLink` with the local secret key, which needs no backdoor in production code.
    - **Full flow:** the admin creates game `TEST42`, a wrong join code is rejected, 3 players join (one by typing the code, two through the join link), the admin generates a ring that forms a cycle, each player's game page shows the target from the ring, a shakeup shows round 2, and a non-admin gets 404 on `/admin`.
    - **Join link:** a logged-out visitor to `/join/CODE` logs in through the real email link (or the code) and lands back on the link.
    - **Multi-game:** two live games at once, one player in both with a target in each, `JOIN_CODE_TAKEN`, and a finished game that is read-only, has a dead join link and frees its code.
    - **Lockdown spec:** the publishable key gets no access to schema `game` through PostgREST.
- **Prod smoke test:** log in, create a game, join with two accounts, shuffle, and check both target pages.

## Risks and notes
- Supabase's built-in SMTP is heavily rate-limited, so **custom SMTP is required** before real signups.
- Without `jws-algorithms: ES256`, every token is rejected. The security ITs guard against this.
- Fly must connect through the Supabase session pooler. The direct host is IPv6-only.
- Supabase free projects pause after about 7 days idle.
- Join codes are at least 6 characters, and wrong codes are limited per account (`JoinCodeAttemptLimiter`, in memory).
- `supabase db reset` wipes the Flyway schema. Restart the API to re-migrate (document this in CLAUDE.md).
