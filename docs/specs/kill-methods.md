# Kill methods

Every kill records the method used. Methods are per game, have a points value, and replace the killer's flat +10.

## Decisions (from Q&A)
- Per-game `kill_method` table: `name`, `points`, `enabled`. Methods are never deleted, only disabled, so old kills keep their method.
- New games are seeded with the standard set (all 10 points unless noted): Clamp, Ticker Bomb, Poison, Electric Chair, Goodbye Note, Duel (15), Death Sentence, ADoS Injection, Remote Shutdown, Hand Grenade.
- Admin can enable/disable, rename, change points and add methods **only as part of starting a round** (round 1 via Generate ring, later rounds via Start new round), in the same step as the player list. Applied in the same transaction.
- The method is required when recording a kill: the killer picks it when filing a self-reported claim (copied to the kill on accept); the admin picks it when registering a kill. Only enabled methods can be chosen.
- Admin can correct the method on an existing kill.
- Killer's ledger points = the method's points (replaces +10). Victim stays -5.
- Existing data: games get the standard set; existing kills and open claims get a random method from it. Ledger rows are not rewritten.

## Assumptions (shout if wrong)
- Ledger is append-only, so correcting a kill's method writes an offsetting `ADJUST` row for the killer (new method points minus old), tied to the kill. No-op if points are equal.
- A claim stores `kill_method_id`; the method can't change after filing (withdraw and refile).
- Method names are unique per game (case-insensitive). At least one method must stay enabled to start a round (`NO_ENABLED_METHODS`).
- Start-round / Generate-ring request gains `killMethods: [{id?, name, points, enabled}]`, omitted = unchanged. `points` >= 0.

## Data model (Flyway V9)
- New `game.kill_method`: `id`, `game_id`, `name`, `points` (int), `enabled`, `created_at`. Unique `(game_id, lower(name))`, unique `(id, game_id)`. Standard RLS-on/grants-revoked block.
- `game.kill.kill_method_id` and `game.kill_claim.kill_method_id`: composite FK to `kill_method (id, game_id)`; backfilled randomly. Nullable in V9; V10 (task 3) sets `NOT NULL` once recording a kill supplies a method.
- `point_event.type` check gains `ADJUST`.
- Default set lives in one Java constant, used for new games; the migration seeds the same names for existing games.

## API
- `GET /api/admin/games/{gameId}/kill-methods` and `GET /api/me/games/{gameId}/kill-methods` (player sees enabled only).
- `POST /api/admin/games/{gameId}/kills` gains `killMethodId`; `POST /api/me/games/{gameId}/kill-claims` gains `killMethodId`. Errors: `KILL_METHOD_REQUIRED`, `KILL_METHOD_NOT_FOUND`, `KILL_METHOD_DISABLED`.
- `PATCH /api/admin/games/{gameId}/kills/{id}` `{killMethodId}` (admin correction, writes `ADJUST`).
- Kill and claim responses include `killMethod: {id, name}`.

## Tasks
- [x] 1. Flyway V9, `KillMethod` entity/repo, default-set constant, seed on game creation. IT: new game has the 10 methods. (Backfill SQL not covered by an IT: the migration runs on an empty DB.)
- [x] 2. Methods apply on start-round and Generate ring (`killMethods` payload, validation, `NO_ENABLED_METHODS`) plus the GET endpoints. ITs for each.
- [ ] 3. Required `killMethodId` on admin kill and claim filing; `KillService.applyKill` takes the method and `PointService.recordKill` uses its points; V10 makes `kill_method_id` NOT NULL. ITs: points follow method, disabled/missing/foreign-game method rejected, claim accept carries the method.
- [ ] 4. Admin kill-method correction (`PATCH`) with `ADJUST` ledger row. ITs.
- [ ] 5. Web: `lib/api.ts` + error maps; method select on the admin kill form and player claim form; method editor in the generate-ring and start-round forms; method shown on kill/claim lists; admin correction control. Vitest.
- [ ] 6. E2E: extend kills/full-flow spec. Update existing ITs/e2e that register kills. Add `docs/progress.md` entry and `docs/architecture.md` schema if listed.
