# Leaderboard and points

Players earn points for kills and lose them when killed. Everyone in a game (players and admin) can see a ranked leaderboard.

## Decisions (from Q&A)
- Points come from an **append-only ledger**, not a value derived from kills. More sources are planned (kill-method multipliers, team performance, admin bonuses), so each point event is its own row.
- For now: killer gets **+10**, victim gets **-5**. Negative totals are allowed. Values are constants in code; the ledger stores the delta actually awarded, so changing them later doesn't rewrite history.
- Both ledger rows are written in the same transaction as the kill (`KillService.applyKill`), so every way of registering a kill (admin and confirmed claim) scores.
- **No backfill.** Kills that exist before the migration score nothing.
- Leaderboard shows a **game total** with a **per-round** view (selector: Total / Round 1 / Round 2 ...).
- Everyone sees the full list, including dead and removed players. Columns: rank, name, points, kills, deaths, alive/dead status.
- Ties share a rank (competition ranking: 1, 2, 2, 4), ordered by points desc, kills desc, name.
- Separate pages per game: `/games/{gameId}/leaderboard` (player) and `/admin/games/{gameId}/leaderboard` (admin), linked from the existing game pages.

## Assumptions (shout if wrong)
- The ledger is never edited or deleted. Corrections are new offsetting rows.
- Kills and deaths per round are counted from `PointEvent` rows of type `KILL` / `DEATH`, not from the `kill` table, so they stay consistent with points.
- Per-round points use the ledger's `game_round_id`. Events with no round (e.g. a future game-wide bonus) count in the total only.
- Players with no events appear with 0 points. Players in the game with status `REMOVED` appear too. Players are listed from the current roster.
- Totals are computed on read with a `SUM` grouped by player; no cached total column yet.

## Data model (Flyway V8)
New `game.point_event`: `id` (bigserial), `game_id`, `game_round_id` (nullable, composite FK to `game_round`), `player_id` (composite FK to `player`), `points` (int, can be negative), `type` (check in `KILL`, `DEATH`; later `BONUS`, `TEAM`...), `kill_id` (nullable FK to `game.kill`), `created_at`, `created_by` (nullable). Unique `(kill_id, player_id)` where `kill_id is not null` so a kill can't score twice. Index on `(game_id, player_id)`. Same RLS-on and grants-revoked block as the other game tables.

## API
- `GET /api/admin/games/{gameId}/leaderboard?roundNo=` (`requireAdmin`)
- `GET /api/me/games/{gameId}/leaderboard?roundNo=` (404 `NOT_IN_GAME` otherwise)
- Same response from both: `{roundNo|null, rounds: [roundNo...], entries: [{rank, player: PlayerRef, points, kills, deaths, status}]}`. No `roundNo` = game total. Unknown `roundNo` -> 404 `ROUND_NOT_FOUND`.

## Tasks
- [x] 1. Flyway V8 `point_event`, `PointEvent` entity/repository, `PointService.recordKill(kill)` with the +10/-5 constants; call it from `KillService.applyKill`. IT: a kill writes two rows, a second identical write is rejected, and a kill in round 2 is tagged with round 2.
- [ ] 2. `LeaderboardService` (aggregate, ranking with ties, round filter) plus unit tests for ranking and ties. IT: totals across two rounds, negative totals, zero-point players.
- [ ] 3. Admin and player leaderboard endpoints, with ITs for auth (`NOT_IN_GAME`, non-admin 403) and `ROUND_NOT_FOUND`.
- [ ] 4. Web: `lib/api.ts` fetchers, shared `Leaderboard` component with round selector, player and admin pages, links from the existing game pages. Vitest for the component/fetchers.
- [ ] 5. E2E: extend the full-flow spec (or add one) to check the leaderboard after kills across two rounds. Update `docs/progress.md` and `docs/architecture.md` if it lists the schema.
