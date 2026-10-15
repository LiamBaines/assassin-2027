# Game slugs replace UUIDs

## Context
Game URLs like `/games/ccd6ac14-…` are ugly. Games get a name-derived slug (`work-assassin`) that becomes the game's id everywhere, and the player view moves from `/games/{id}` to `/{slug}`.

## Decisions (agreed)
- Slug **is** the primary key (`game.game.id text`). No UUID game id in any layer (DB, API paths/JSON, web routes, tests).
- Fixed at creation; rename only changes `name`.
- Existing data is test data: wipe, no backfill, no redirects from old URLs.
- Collision: `work-assassin`, then `work-assassin-2`, `-3`, …

## Assumptions (shout if wrong)
- "UUID removed" covers **game** ids only. Player, round, kill ids stay UUID.
- Admin routes stay `/admin/games/{slug}`; only the player view loses `/games`.
- Top-level `/{slug}` collides with `admin, login, join, me, auth, api, games, _next` etc. These are reserved: such a name gets a suffix (e.g. `admin-2`).
- Slug rules: lowercase, non-alphanumerics → `-`, trimmed, max ~40 chars; empty result (e.g. name is all emoji) falls back to `game`.

## Tasks
1. [x] Branch `game-slugs`. Migration `V13`: truncate game tables; `game.game.id` → `text` with `check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`; change every `game_id` column + FK to `text`.
2. [x] API: `Game.id` becomes `String` (no `@GeneratedValue`); new `SlugGenerator` (slugify + reserved list + `-N` suffix, checked against the repository; retry on unique-violation race); `GameService.create` uses it. `UUID gameId` → `String gameId` across controllers/services/repositories (~100 sites in `game/`, `targeting/`, `player/`, `event/`).
3. [x] API tests: unit test for the slug generator (collision, reserved, empty); update ITs for `String` ids.
4. [ ] Web: move `app/games/[gameId]/**` → `app/[slug]/**` (reserved top-level routes win in Next). Rename param in admin routes. Delete `lib/uuid.ts` (+ test) and its use in `load-game.ts`, `actions.ts`, `last-view.ts`; update links, `api.ts`, `api-types.ts`, `proxy.ts` auth paths, `safeNextPath` callers.
5. [ ] E2E: update the specs (`full-flow`, `multi-game`, `join-link`, etc.) for the new URLs; keep every `data-testid`.
6. [ ] Docs: amend ADR 0003 (id in path is now the slug), `docs/architecture.md`, append to `docs/progress.md`; copy this plan to `docs/specs/game-slugs.md`.

## Verification
- `./mvnw test`, then `./mvnw verify` (needs Colima/Docker) for ITs.
- `pnpm lint && pnpm typecheck && pnpm test`.
- `./scripts/e2e.sh`, plus a Playwright check: create two games named "Work Assassin" → `/work-assassin` and `/work-assassin-2`; a game named "Admin" → `/admin-2`.

## Notes
- Per workflow, I'll do one task at a time and stop after each.
- Prod: migration wipes prod game data. Confirm that's intended before deploying.
