# Bonus points

The admin can award or dock bonus points (BP) for a player, with a required reason. A bonus can optionally be linked to an existing kill. Bonuses show in the game log, on the leaderboard in a new BP column, and the player gets an inbox message.

## Decisions (from Q&A)
- Bonuses are `point_event` rows of a new type `BONUS`. Not `ADJUST`: `awardedForKill` sums `KILL` + `ADJUST`, so a kill-linked `ADJUST` bonus would be cancelled by the next kill-method correction.
- Amount: non-zero integer, -100 to 100. Totals can go negative. Reason: required, trimmed, 1 to 140 characters.
- Optional `killId`. A kill-linked bonus goes to the **killer only** and takes the kill's round. A kill can carry several bonuses (the unique index only covers `KILL`/`DEATH`).
- Ad hoc bonus takes the round active when applied. With no active round, `game_round_id` is null and it counts toward the total only.
- Any player can receive a bonus (alive, dead or removed).
- No undo. A mistake is fixed with an opposite bonus.
- The game log shows every bonus publicly: player, amount, reason, and the kill when linked. New event type `BONUS_AWARDED` (no migration, `game_event` has no type constraint).
- Inbox: a read-only **Admin** conversation per player, next to "Your target" and "Your assassin". It belongs to the player, not an assignment, so it survives shakeups and rounds. It uses the existing unread count and bubble. No rate limit or eligibility check applies (players can't send to it).
- Admin console: new **Bonuses** tab listing bonuses (newest first) with an "Award points" action.
- Leaderboard: new **BP** column, the sum of `BONUS` rows in the selected view (Total or a round). The Points column is still the total of all rows, so it includes BP.

## Assumptions (shout if wrong)
- The Bonuses tab shows player, amount, reason, round, linked kill and time. It doesn't need pagination at first (cap at the latest 200).
- Kill picker in the dialog lists kills newest first, labelled "killer → victim, round N".
- Inbox text: "You were awarded +5 bonus points: <reason>." / "You lost 5 bonus points: <reason>." Sender is shown as "Admin".
- Kills and deaths counts on the leaderboard are unchanged.

## Data model (Flyway V18)
- `point_event`: widen `point_event_type_ck` to include `BONUS`; add nullable `reason text` (check length 1 to 140 when not null).
- `message`: add `kind text not null default 'PLAYER'` (`PLAYER|ADMIN`), `recipient_id uuid` (composite FK to player), make `assignment_id` and `sender_id` nullable. Check: `PLAYER` requires both set, `ADMIN` requires `recipient_id` and neither of the others.

## API
- `POST /api/admin/games/{gameId}/bonuses` `{playerId, points, reason, killId?}`: validates, writes the `BONUS` row, the `BONUS_AWARDED` event and the Admin message in one transaction. Errors: `INVALID_BONUS_POINTS` (zero or out of range), `REASON_REQUIRED`, `PLAYER_NOT_FOUND`, `KILL_NOT_FOUND`, `KILL_PLAYER_MISMATCH` (`playerId` isn't the kill's killer).
- `GET /api/admin/games/{gameId}/bonuses`: the list above.
- Leaderboard entries gain `bonusPoints`.
- Player message endpoints return the Admin thread; sending to it is rejected.

## Tasks
1. [x] Migration V18, `PointType.BONUS`, `PointEvent.reason`, `PointService.recordBonus`. IT: ad hoc bonus tagged with the active round, null round before round 1, kill-linked bonus takes the kill's round, and a later kill-method correction leaves the bonus intact.
2. [ ] `BonusService` + admin endpoints (create, list) with validation, the `BONUS_AWARDED` event and the Admin inbox message in one transaction. ITs for each error code, admin-only access, and rollback when the message write fails.
3. [ ] Admin inbox thread in `MessageService` (list, unread count, mark read, send rejected). ITs: survives a shakeup, unread count, removed player.
4. [ ] Leaderboard `bonusPoints` in `LeaderboardService` and both endpoints, with a round filter. Unit tests and ITs.
5. [ ] Web data layer: `api.ts`, `api-types.ts`, error-code messages in `src/app/admin/actions.ts`, BP column in the shared `Leaderboard` component, `BONUS_AWARDED` rendering in `EventLog`. Vitest.
6. [ ] Admin Bonuses tab (`requireAdmin()`, nav entry, list, award dialog with player select, amount, reason, optional kill select; empty, loading and error states).
7. [ ] Player inbox: Admin conversation in the thread list (read-only, no composer).
8. [ ] E2E spec: award an ad hoc and a kill-linked bonus, check the leaderboard BP column, the log and the inbox message. Update `docs/progress.md` and `docs/architecture.md`.

## Verification
`./mvnw test -Dtest=...` per task, `./mvnw verify` once at the end; `pnpm lint && pnpm typecheck && pnpm test`; `./scripts/e2e.sh e2e/<new spec>` then the full e2e.
