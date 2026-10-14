# Game event log

## Context
Players (and admins) need a most-recent-first log of everything that happened in a game: kills, removals, round starts/shakeups, joins. More event types will be added later, so events are stored in a dedicated append-only table with names snapshotted into the payload.

Decisions (from Q&A): dedicated `game.game_event` table; events at launch = KILL, PLAYER_REMOVED, PLAYER_RESTORED, ROUND_STARTED, SHAKEUP, PLAYER_JOINED; no backfill; player + admin views; paginated.

## Design
- Migration `V12__game_event.sql`: `game.game_event(id bigint identity pk, game_id uuid fk, type text, payload jsonb not null, created_at timestamptz default now())`, index `(game_id, id desc)`, RLS on + revoke anon/authenticated (copy V8 pattern). No type check constraint (new types shouldn't need a migration).
- API `com.assassin.api.event`: `GameEventService.record(gameId, type, payload)` (`Propagation.MANDATORY`, so it commits with the action) and `list(gameId, beforeId, limit)` returning `{events:[{id,type,createdAt,data}], nextBefore}` (keyset pagination, limit default 30 / max 100).
- Record calls, all inside existing locked transactions:
  - `KillService.applyKill` -> KILL `{killer, victim, method}` (names + ids)
  - `AdminPlayerService.updateStatus` -> PLAYER_REMOVED `{player}` when set to REMOVED, PLAYER_RESTORED `{player}` when set to ALIVE
  - `RingService.startRound` -> ROUND_STARTED `{roundNo, playerCount}`; `RingService.shuffle` -> ROUND_STARTED for the initial ring (round 1), SHAKEUP `{roundNo}` otherwise
  - `PlayerService.signup` -> PLAYER_JOINED `{player}`
- Endpoints (pattern of `LeaderboardController`): `GET /api/me/games/{gameId}/events` (404 NOT_IN_GAME for non-members) and `GET /api/admin/games/{gameId}/events`; both take `before` and `limit`.
- Web: `getMyEvents` / `getAdminEvents` in `src/lib/api.ts` + types in `api-types.ts`; one shared `EventLog` component in `components/` that renders by `type` (unknown types fall back to a generic line) with icon + text + `formatDateTime`; empty/error states per design language. Player: add `log` to `VIEWS`/`GameView` (`?view=log`) in `games/[gameId]/page.tsx` + `game-shell.tsx`. Admin: `admin/games/[gameId]/log/page.tsx` with `requireAdmin()` + entry in `game-nav.tsx`. "Load more" via a `before` search param link (server-rendered, no client JS). Keep all existing `data-testid`s; new ones: `event-log`, `event-item`.

## Tasks
1. [x] Migration + `GameEventService` + list endpoints + IT (pagination order, non-member 404)
2. [x] Record events from kill, removal, round/shakeup, join (+ IT assertions per type)
3. [x] Web api client, `EventLog` component, player `log` view + vitest for rendering/formatting
4. [x] Admin log page + nav entry
5. [x] Playwright e2e: kill and removal appear in log; update `docs/progress.md`

## Verification
`./mvnw test -Dtest=...` per task, `./mvnw verify` once at end; `pnpm lint && pnpm typecheck && pnpm test`; `./scripts/e2e.sh e2e/<new spec>` then full e2e.
