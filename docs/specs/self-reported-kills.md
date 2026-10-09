# Self-reported kills

An assassin claims a kill on their target from their game page. The victim accepts or contests. Accept confirms the kill with no admin input (same effect as the admin "Register kill" in `register-kills.md`). The admin sees all open claims and can confirm or dismiss any of them.

## Decisions (from Q&A)
- Admin may resolve a claim at any time, whether the victim has responded or not (and after a contest).
- A dismissed claim does not block a new one. Only one **open** claim per victim at a time.
- The victim is notified by a banner on `/games/[gameId]` only (no email, no polling).
- The killer can withdraw an open claim.

## Assumptions (shout if wrong)
- A claim is always against the killer's current ACTIVE target. The victim is never chosen by the client.
- A contested claim stays open until the admin resolves it. The victim can't change their answer after responding. The killer can still withdraw.
- Claims are not auto-expired.
- Shakeups, splices and other kills can make a claim stale (its assignment is no longer ACTIVE). A stale claim is closed as `VOIDED` and can't be accepted or confirmed (409 `CLAIM_STALE`). Open claims touching a player or assignment are voided inside the same transaction that changes the ring, so the lists never show stale ones.
- Confirming (by victim or admin) reuses `KillService` logic, so the ring splice, game-finish and `kill` row are identical. `kill.registered_by` is the victim's or admin's email.

## Data model (Flyway V4)
`game.kill_claim`: `id`, `game_id`, `assignment_id` (killer to victim, must be ACTIVE when filed), `killer_id`, `victim_id` (composite FKs like `kill`), `status`, `created_at`, `resolved_at`, `resolved_by` (email or null), `kill_id` (null unless confirmed, FK to `kill`).

`status`: `PENDING` (awaiting victim), `CONTESTED`, `CONFIRMED`, `DISMISSED`, `WITHDRAWN`, `VOIDED`.
- Partial unique index on `victim_id` where status in (`PENDING`, `CONTESTED`): one open claim per victim.
- Same RLS-on and grants-revoked block as `kill`.

## API
Player (caller must be a player in the game; 404 `NOT_IN_GAME` otherwise):
- `POST /api/me/games/{gameId}/kill-claims` (no body) -> 201 `{id, status}`. Targets the caller's ACTIVE assignment.
  - 409 `GAME_NOT_STARTED` / `GAME_FINISHED`, 409 `NO_TARGET`, 409 `CLAIM_ALREADY_OPEN`.
- `POST /api/me/games/{gameId}/kill-claims/{id}/withdraw` -> killer only, open claims only.
- `POST /api/me/games/{gameId}/kill-claims/{id}/accept` -> victim only, `PENDING` only. Confirms the kill, returns `{status: CONFIRMED, gameFinished}`.
- `POST /api/me/games/{gameId}/kill-claims/{id}/contest` -> victim only, `PENDING` only. Status -> `CONTESTED`.
- `GET /api/me/games/{gameId}/kill-claims/mine` -> `{outgoing: {id, status}|null, incoming: {id, killerName}|null}`. Incoming is only the `PENDING` claim against the caller. Outgoing is the caller's latest claim if open, or resolved within the current view so they can see "dismissed". Only display names are revealed.
- Wrong role -> 403 `NOT_CLAIM_PARTICIPANT`. Already-resolved -> 409 `CLAIM_NOT_OPEN`.

Admin (`requireAdmin`):
- `GET /api/admin/games/{gameId}/kill-claims?status=open` -> open claims with killer/victim names, status, `created_at`.
- `POST /api/admin/games/{gameId}/kill-claims/{id}/confirm` -> same result shape as the admin kill (`KillResult`).
- `POST /api/admin/games/{gameId}/kill-claims/{id}/dismiss` -> status `DISMISSED`.

All confirm paths run under `GameService.lockForChange`, re-check the claim is open and its assignment is still ACTIVE, then run the existing kill logic.

## Tasks
1. [x] V4 migration `game.kill_claim` + entity, status enum, repository.
2. [x] Refactor `KillService`: extract the core `applyKill(game, victim, registeredBy)` so admin register and claim confirm share it. Existing `KillIT` must still pass.
3. [ ] `KillClaimService` + player controller (file, withdraw, accept, contest, mine). Void open claims inside `RingService` when it changes the ring (shakeup, splice, kill).
4. [ ] Admin controller (list open, confirm, dismiss).
5. [ ] API ITs: file, double file, no target, accept confirms and splices, contest then admin confirm/dismiss, admin confirm before victim responds, withdraw, wrong participant 403, stale claim voided by shakeup and by another kill, last-two kill finishes the game, SETUP/FINISHED games.
6. [ ] Web `api.ts` calls + types, Vitest for helpers.
7. [ ] Web: `/games/[gameId]` gets a "Register kill" button (with confirm) and status line for the killer, plus an accept/contest banner for the victim. Server actions with code -> message maps in a new `games/[gameId]/actions.ts`.
8. [ ] Web: admin "Kill claims" card on `admin/games/[gameId]/players` (or its own page) with Confirm/Dismiss, calling `requireAdmin()`.
9. [ ] Playwright e2e (`claims.spec.ts`, own game code): accept path, contest then admin dismiss, contest then admin confirm. Switch `roster.spec.ts` off `setPlayerStatusInDb` if cheap.
10. [ ] Docs: `architecture.md` (data model, API), `progress.md` entry.

One task at a time, stop after each.

## Verification
- `./mvnw test -Dtest=...` while iterating; `./mvnw verify` once at the end (needs Colima).
- `pnpm typecheck && pnpm lint && pnpm test`, then `./scripts/e2e.sh e2e/claims.spec.ts`.
