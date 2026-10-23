# Duels

If the game has an enabled kill method named "Duel", an assassin can challenge their target to a duel in the inbox thread. If the target accepts, the assassin's identity is revealed and the winner of the duel scores a kill.

## Decisions (from Q&A)
- Points: the winner gets the Duel method's points (15 by default, admin-editable). The loser takes the normal -5.
- Assassin wins: an ordinary kill (assassin kills target, inherits the target's target, same splice).
- Target wins: recorded as a kill with killer = target, victim = challenger, method Duel. The challenger is removed from the ring. The challenger's own assassin gets the winner as their new target and is notified. The winner's own target is unchanged (the ring splices `Z -> A -> B` into `Z -> B`; this differs from the normal splice).
- Challenge: the assassin picks the activity (free text) and sends it through a two-step dialog. Step 2 warns "If accepted, [target] will learn who you are" with a final Send challenge button.
- Decline closes the challenge, and the assassin may issue another. Only one open duel per assassin at a time. The assassin can revoke a challenge before it is accepted.
- Accept reveals the assassin's name to the target, permanently. The thread and the duel card show it. A later void doesn't hide it.
- **No freeze.** A pending or accepted duel never blocks anything. A normal kill claim, an admin kill, a shakeup or a new round on the pair voids an open duel (`VOIDED`, as stale claims are), so a target can't accept and then stall to stay safe.
- Result: after acceptance either player reports the winner. The other player accepts or contests. A contest goes to the admin, who picks the winner. The admin can resolve any open duel at any time.
- Admin sees duels in the event log and an open-duels list.

## Assumptions (shout if wrong)
- "Duel is in play" means an enabled kill method whose name is "Duel" (case-insensitive). Renaming or disabling it hides the challenge action. Existing duels still resolve, using the method row they were created with.
- "Open" means `PENDING`, `ACCEPTED` or `REPORTED`/`CONTESTED` (all unresolved). The one-open-duel limit covers all of them.
- A duel belongs to an assignment. It voids when that assignment ends for any reason other than the duel itself.
- The challenge is a new message kind `DUEL` in the existing thread, pointing at the duel row. Its card shows activity, status and the right buttons per role (target: Accept/Decline while pending; assassin: Revoke while pending; both: report/confirm/contest after acceptance). Unread works as for other messages.
- The challenger's assassin is notified by a system message (new kind `SYSTEM`) in their new, empty thread: "Your target has changed." Their thread has no earlier messages, so it also becomes their first unread. The reporter of the other side gets the same via the thread card.
- Activity text is trimmed, 1 to 80 characters.
- A self-reported kill claim is not used for duels. Duel resolution is the claim.
- If the duel result ends the game (one player left), the game finishes as it does for any kill.
- Resolution runs under `GameService.lockForChange` and reuses `KillService`/`PointService`, with a new "reverse splice" path for target wins.

## Data model (Flyway, next free version)
- `game.duel`: `id`, `game_id`, `assignment_id`, `challenger_id`, `challenged_id`, `kill_method_id`, `activity`, `status`, `reported_winner_id`, `reported_by_id`, `created_at`, `accepted_at`, `resolved_at`, `resolved_by`, `kill_id`. Composite FKs like `kill_claim`. Partial unique index on `challenger_id` where status is open. Standard RLS-on, grants-revoked block.
- `status`: `PENDING`, `ACCEPTED`, `REPORTED`, `CONTESTED`, `COMPLETED`, `DECLINED`, `REVOKED`, `VOIDED`.
- `message.kind` gains `DUEL` and `SYSTEM`; `message.duel_id` (nullable fk).

## API
Player (`/api/me/games/{gameId}/duels`):
- `POST` `{activity}` -> challenge the caller's ACTIVE target. 409 `DUEL_NOT_AVAILABLE`, `NO_TARGET`, `DUEL_ALREADY_OPEN`.
- `POST /{id}/accept`, `/decline` (target), `/revoke` (challenger, `PENDING` only).
- `POST /{id}/report` `{winner: "ME"|"OTHER"}`, `/{id}/confirm`, `/{id}/contest` (the non-reporting participant).
- Errors: 403 `NOT_DUEL_PARTICIPANT`, 409 `DUEL_NOT_OPEN`.
- Thread/message payloads gain the duel summary and, once accepted, `assassinName` for the target.

Admin (`requireAdmin`): `GET /api/admin/games/{gameId}/duels?status=open`, `POST /{id}/resolve` `{winnerId}`. Duel events go to the game event log.

## Tasks
1. [x] Flyway migration, `Duel` entity/repo, `MessageKind` additions. Challenge, accept, decline, revoke in `DuelService` with the one-open and method checks. ITs.
2. [x] Result flow: report, confirm, contest, admin resolve. Assassin-win through the existing kill path; target-win through the new reverse splice plus points and the `SYSTEM` notification. ITs for both outcomes, ring shape, points, game finish.
3. [x] Voiding: hook into claim/admin kills, shakeups and rounds in the same transactions. ITs.
4. [x] Player endpoints and thread payload changes (duel card data, reveal name). ITs for auth and participant checks.
5. [x] Admin endpoint, open-duels list and event-log entries. ITs.
6. [x] Web data layer: `api.ts`, `api-types.ts`, error maps in `src/app/[gameId]/actions.ts`. Vitest.
7. [x] Player UI: challenge action and two-step dialog, duel card in the thread, reveal, result report/confirm/contest, empty/error states. Vitest and `data-testid`s.
8. [x] Admin UI: open-duels list and resolve control.
9. [x] E2E: challenge, accept, both outcomes, void by kill. Full suite, `docs/progress.md` entry.
