# Players roster

On the player view, once a game has started, any player in that game can see every player's display name and status.

## Requirements and decisions

Decided in the Q&A:

- **Fields per player:** display name and status only. Nothing that hints at who is hunting whom (no ids, emails, targets, kill counts, time of death or eliminator).
- **Who can see it:** any player in that game, alive or dead. Non-members get 404, the same as an unknown game, so game ids can't be enumerated. There is no admin-specific view in this feature.
- **When:** `ACTIVE` and `FINISHED` games. A `SETUP` game returns 404 `GAME_NOT_STARTED`.
- **Freshness:** server-rendered on page load. Players refresh to see changes. No polling or push.
- **Statuses shown:** `ALIVE`, `DEAD`, `REMOVED`, `WAITING`.
  - `REMOVED` players are shown, labelled "Removed".
  - `WAITING` means the player is `ALIVE` but has no `ACTIVE` assignment as an assassin (for example a late joiner before the next shakeup). It is computed in the API, never stored. `DEAD` and `REMOVED` players never show as `WAITING`.
  - In a `FINISHED` game, assignments stay `ACTIVE`, so a late joiner who never got a target still shows `WAITING`. This is intended.
- **Ordering:** by display name, so the order doesn't reveal ring order or join order.
- **Scale:** under 200 players per game (architecture.md), so no pagination.

## API contract

`GET /api/me/games/{gameId}/players`

```json
{ "players": [ { "displayName": "Alice", "status": "ALIVE" } ] }
```

- 404 `NOT_IN_GAME` when the caller has no Player row in the game, or the game doesn't exist.
- 404 `GAME_NOT_STARTED` when the game is `SETUP`.
- The route sits under `/api/**`, so `SecurityConfig` already requires authentication. No config change is needed.

## Files to create or change

### API (`api/src/main/java/com/assassin/api/`)

- Create `player/RosterController.java`, modelled on `targeting/TargetController.java`.
  - `@Transactional(readOnly = true)`, takes `CurrentUser` and `@PathVariable UUID gameId`.
  - Membership check via `existsByGameIdAndAuthUserId`.
  - Game status check via the game repository. Throws `ApiException` with `NOT_IN_GAME` or `GAME_NOT_STARTED`.
  - Nested response records, for example `RosterResponse(List<RosterEntry>)` and `RosterEntry(displayName, status)`, where status is a string enum that adds `WAITING` to `PlayerStatus`.
- Change `player/PlayerRepository.java`: add a roster query ordered by display name, returning the display name, the status and whether the player has an `ACTIVE` assignment as assassin. Use a single left join or `NOT EXISTS`, not a query per player.
- Create `api/src/test/java/com/assassin/api/player/RosterIT.java`, extending `IntegrationTest`.

### Web (`web/src/`)

- Change `lib/api-types.ts`: add `RosterStatus` (`"ALIVE" | "DEAD" | "REMOVED" | "WAITING"`), `RosterEntry` and `Roster`.
- Change `lib/api.ts`: add `getGamePlayers(gameId)`. It uses `nullOn("GAME_NOT_STARTED", request<Roster>("GET", ...))` and `seg(gameId)`, like `getMyTarget`.
- Change `lib/player-status.ts` (or add a small sibling module): a `rosterStatusView(status)` helper returning label and tone, including a `WAITING` tone (amber). Do not change the existing `playerStatusView`.
- Change `app/games/[gameId]/page.tsx`: add a "Players" `Card` below the target card, rendered only when the game isn't `SETUP`. Each row has `data-testid="roster-row"`, and the status badge has `data-testid="roster-status"`.
- Add unit tests in `lib/api.test.ts` and `lib/player-status.test.ts`.

### E2E (`web/e2e/`)

- Change `full-flow.spec.ts` (or add a spec after it, since specs are serial): see tasks below.

### Docs

- `docs/architecture.md`: add the endpoint to the API table, and the roster to the `/games/[gameId]` route description.
- `docs/progress.md`: append a decision entry (statuses, `WAITING` semantics, ordering, `SETUP` 404).

## Tasks

Work on a feature branch. Single-line imperative commit messages. Each task should leave the build green.

There is no migration: no schema change is needed.

1. **API: roster query and endpoint, with IT.**
   - Add the repository query and `RosterController`.
   - `RosterIT` cases:
     - A member sees all players, sorted by display name.
     - A `DEAD` player shows `DEAD`.
     - A `REMOVED` player shows `REMOVED`.
     - A late joiner (inserted after the ring is generated) shows `WAITING` while ringed players show `ALIVE`.
     - A `DEAD` or `REMOVED` player with no assignment never shows `WAITING`.
     - A stranger gets 404 `NOT_IN_GAME`.
     - An unknown game UUID gets 404.
     - A `SETUP` game gets 404 `GAME_NOT_STARTED`.
     - A `FINISHED` game (set via `jdbc.update`) still returns the roster.
     - A caller in game A can't see game B's roster.
     - The response has no `id`, `email` or other fields: assert `$.players[0].id` and `$.players[0].email` don't exist.
   - Verify with `./mvnw verify` (needs Docker/Colima).
2. **Web: types, API client, status helper, with vitest.**
   - Add the types, `getGamePlayers`, and `rosterStatusView`.
   - Tests: the URL is scoped to the game and the id is encoded; null comes back on `GAME_NOT_STARTED`; other errors still throw; each status maps to the right label and tone.
   - Verify with `pnpm test`, `pnpm lint` and `pnpm typecheck`.
3. **Web: Players card on the player page.**
   - Add the card, hidden for `SETUP` games. Verify manually with `./scripts/dev.sh`, or through the e2e in task 4.
4. **E2E spec.**
   - After the ring is generated, Alice sees all three players with `ALIVE` status, and no ids or emails in the DOM.
   - After an elimination, that player shows `DEAD` on every player's page.
   - A player who joins after the start shows `WAITING`.
   - Before the game starts, there is no Players card.
   - Verify with `./scripts/e2e.sh e2e/<spec>`. See `docs/e2e.md` for the stale-server gotcha.
5. **Docs.** Update `docs/architecture.md` and append to `docs/progress.md`.
6. **Verify and ship.** Run the full suite (`./mvnw verify`, `pnpm test`, `./scripts/e2e.sh`), run a review pass, then open a PR. Squash and merge, and delete the branch.

## Out of scope

- Kill counts, time of death, who eliminated whom, or any kill log or leaderboard (later features in architecture.md).
- Showing assassin/target relationships or ring order.
- Polling, SSE or websockets.
- Pagination or search of the roster.
- An admin-specific roster. Admins already have the admin player list.
- Showing the roster before the game starts, or to non-members.
- Any schema or Flyway migration.
