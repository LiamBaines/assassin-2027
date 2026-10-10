# Rounds

A game can run several **rounds**. The admin can start a new round at any time. It revives dead players, lets the admin pick who plays (including late joiners from the bench), and allocates a fresh ring. Shakeups still exist, within a round.

## Decisions (from Q&A)
- "Round" is a new game-level concept (1, 2, 3...). Existing `assignment_round` is renamed `allocation` so the two don't collide. Within a round the first allocation is `INITIAL` and later ones are `SHAKEUP`.
- Round 1 starts with the existing Generate ring. Later rounds start with a separate "Start new round" action.
- A new round can be started mid-round. The old round just closes with no winner. A winner is only recorded when a kill leaves one player.
- Starting a round shows every player with a tick box. Pre-ticked: everyone except those currently `REMOVED`. Ticked -> `ALIVE` and in the ring. Unticked -> `REMOVED`. (Ticking a `REMOVED` player brings them back.)
- Shakeup is unchanged: it reshuffles ALIVE players in the current round. The dead stay dead and the bench stays on the bench.
- A kill in a 2-player ring ends the round (winner recorded). The game stays `ACTIVE` with no live ring. `FINISHED` becomes admin-only (existing PATCH).
- Players see the current round number on their game page, plus past rounds with the winner and their own outcome.

## Assumptions (shout if wrong)
- Min 2 ticked players to start a round (`NOT_ENOUGH_PLAYERS`).
- Open kill claims are voided when a round starts or ends, in the same transaction.
- After a round ends by a final kill, shakeup is rejected (409 `ROUND_ENDED`). Only a new round can follow.
- A player's outcome for a past round is derived, not stored: `KILLED` (with the killer's name), `SURVIVED` (had an assignment in that round, was not killed), or `OUT` (no assignment in that round, or removed from it).
- Kill history is never deleted. Old assignments become `SUPERSEDED`.
- No data migration beyond the rename: an existing game with allocations gets a round 1 (open, no winner) that owns them all.

## Data model (Flyway V5)
- Rename `game.assignment_round` -> `game.allocation`; rename `round_no` -> `allocation_no` (still unique per game; still what `expectedCurrentRoundNo` checks, so rename that to `expectedAllocationNo` too); add `game_round_id` FK.
- New `game.game_round`: `id`, `game_id`, `round_no` (unique per game), `started_at`, `ended_at` (null while open), `winner_id` (nullable, composite FK to player), `created_by`. Partial unique index: one open round (`ended_at is null`) per game.
- Same RLS-on and grants-revoked block as the other game tables.

## API
Admin (`requireAdmin`):
- `POST /api/admin/games/{gameId}/rings`: unchanged shape. Creates round 1 on the first call; otherwise shakes up the open round. New error: 409 `ROUND_ENDED`.
- `POST /api/admin/games/{gameId}/rounds` `{expectedRoundNo, playerIds}` -> 201 with the new ring (same shape as `rings/current`, plus `roundNo`). Errors: `NO_ROUND` (use rings first), `STALE_ROUND`, `NOT_ENOUGH_PLAYERS`, `PLAYER_NOT_FOUND`, `GAME_FINISHED`.
- `GET /api/admin/games/{gameId}/rounds`: `[{roundNo, startedAt, endedAt, winner, playerCount}]`, newest first.
- `rings/current` and `rings` history gain `gameRoundNo`.

Player (404 `NOT_IN_GAME` otherwise):
- `GET /api/me` per-game `game` gains `currentRoundNo` (null before round 1).
- `GET /api/me/games/{gameId}/rounds` -> `[{roundNo, startedAt, endedAt, winner, myOutcome, killedBy}]` for closed rounds, newest first.

Start-round transaction (holds the game row lock, `GameService.lockForChange`): check `expectedRoundNo` -> close the open round (`ended_at`, no winner) -> void open claims -> supersede ACTIVE assignments -> set player statuses from the pick list -> insert `game_round` + `INITIAL` allocation -> run `RingGenerator` on the ticked players.

`KillService`: when the kill leaves a 2-player ring, close the round with `winner_id` instead of setting the game `FINISHED`.

## Web
- `/games/[gameId]`: "Round N" badge; "Past rounds" card (winner, my outcome).
- `/admin/games/[gameId]/rings`: show the round number; "Start new round" button opening a dialog with the player tick list and confirm; Shake up hidden/disabled when the round has ended; round list.
- Error code messages in `src/app/admin/actions.ts`.

## Tasks
1. [x] Branch `rounds`. Flyway V5 (rename, `game_round`, backfill round 1). Rename the entity, repo and service code (`AssignmentRound` -> `Allocation`) and fix existing tests; all ITs green.
2. [x] `GameRound` entity/repo. `RingService` creates round 1 on the first ring, links allocations, returns `gameRoundNo`. ITs.
3. [x] `POST /rounds` start-new-round (pick list, revive/remove, void claims, supersede) + ITs, including mid-round start and a late joiner.
4. [ ] `KillService` ends the round with a winner instead of finishing the game; `ROUND_ENDED` on shakeup; ITs (update existing 2-player tests that expect `FINISHED`).
5. [ ] Read endpoints: admin `GET /rounds`, `/api/me` `currentRoundNo`, player `GET /rounds` with derived outcomes + ITs.
6. [ ] Web: `lib/api.ts` types/calls, player game page (badge, past rounds), vitest.
7. [ ] Web: admin rings page (Start new round dialog, ended state), error messages.
8. [ ] e2e: round 2 flow (revive, late joiner, unticked player removed, player sees Round 2). Update `docs/architecture.md`, append to `docs/progress.md`, update CLAUDE.md terminology (round vs allocation); full `./mvnw verify`, `pnpm test`, `./scripts/e2e.sh`.
