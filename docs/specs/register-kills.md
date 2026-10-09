# Register kills

Admin registers a kill from the console. The victim is removed from the ring and marked DEAD, and the victim's assassin inherits the victim's target.

## Decisions (from Q&A)
- Admin supplies the **victim only**. The killer is the assassin of the victim's ACTIVE assignment.
- Last kill (only one ALIVE player left in the ring): game auto-finishes (`FINISHED`, `finished_at`), the survivor is the winner.
- New `kill` table (Flyway V3). Update `docs/architecture.md` data model and API table.
- UI: "Register kill" button per row on the admin players page, with a confirm step.

## Behaviour
`POST /api/admin/games/{gameId}/kills` `{victimId}` -> 201 `{killId, killer, victim, newTarget|null, gameFinished}`

In one transaction holding `GameService.lockForChange`:
1. Game must be ACTIVE (SETUP -> 409 `GAME_NOT_STARTED`; FINISHED already -> 409 `GAME_FINISHED`).
2. Victim must exist in the game (404 `PLAYER_NOT_FOUND`), be ALIVE (409 `PLAYER_NOT_ALIVE`), and be a target in an ACTIVE assignment (409 `NOT_IN_RING`, e.g. late joiner with no target).
3. A->X becomes `COMPLETED`, X->T becomes `VOIDED`, A->T is inserted in the same round with source `KILL_INHERIT`. If A == T (two left) nothing is inserted, and the game finishes with A as winner.
4. Victim status -> DEAD. Insert `kill` row (game_id, assignment_id of A->X, killer_id, victim_id, registered_by email, created_at).

## Tasks
1. [x] V3 migration: `game.kill` (composite FKs to player/game like `assignment`, RLS on, grants revoked via same guarded block, unique on victim_id: a player dies once). Kill entity + repository.
2. [x] `RingService`: extract the splice mechanics from `spliceOut` into a shared helper parameterised by end status for the incoming row and the new row's source. `spliceOut` behaviour unchanged (existing tests must still pass).
3. [x] `KillService.register(...)` + `AdminKillController` (path above). Reuse `ApiException` codes style; `Game` gets a finish method if missing.
4. [x] API ITs (extend `IntegrationTest`): 3+ ring kill, two-player kill finishes game, victim not alive, not in ring, SETUP game, non-admin 403, victim in other game 404.
5. [ ] Web: `api.ts` call, server action in `admin/actions.ts` with code->message map, button + confirm on `admin/games/[gameId]/players`. Vitest for the api helper.
6. [ ] Playwright e2e: register a kill, assert victim DEAD and killer's new target.
7. [ ] Docs: architecture.md (data model, API), progress.md entry.

Per your workflow I'll do one task at a time and stop after each.

## Verification
- `./mvnw test -Dtest=...` narrow while iterating; `./mvnw verify` once at the end (needs Colima).
- `pnpm typecheck && pnpm lint && pnpm test`, then `./scripts/e2e.sh e2e/<spec>`.
