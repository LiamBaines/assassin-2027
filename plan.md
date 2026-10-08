# Plan: multiple games (branch `feat/multi-game`)

## Problem
The app allows only one game that isn't FINISHED, and finished games disappear from every API. Admins want to run several games, see past ones, and share a join link (`/join/ABC`) so players don't type the code.

## Decisions (user, 2026-10-08)
- One account can play in several live games at once. The player home lists their games, and each game has its own page and target.
- The admin types join codes, as now. A code must be unique among games that aren't FINISHED, and is free for reuse once its game finishes.
- `/join/ABC` shows "Join <game name>" and asks only for a display name. A logged-out visitor logs in and is returned to the link. Plain `/join` with a typed code still works.
- Finished games are read-only in the admin console. There's no reopen and no delete.

## Success criteria
1. An admin can create a second game while the first is ACTIVE, and run both independently (signups, rings, removals).
2. `/admin` lists every game, including FINISHED ones, and each game's settings, players and rings can be viewed.
3. Any change to a FINISHED game returns 409 `GAME_FINISHED`, and the UI shows no edit controls for it.
4. A logged-out user who opens `/join/CODE` logs in by link or by code, lands back on `/join/CODE`, sees the game name, enters a display name and is in. No code is typed.
5. A player in two games sees both on `/me`, with the right target for each.
6. `./mvnw verify`, the web lint, typecheck, test and build, and `./scripts/e2e.sh` all pass, with new tests covering each item above.

## Scope
**IN:** schema change, game-scoped API, web routes, return-to-link after login, tests, docs (architecture.md, a new ADR 0003, CLAUDE.md).
**OUT:** deleting or reopening games, auto-generated codes, per-game admins, kills (not built yet), notifications.

## Technical approach

### Schema (`V2__multi_game.sql`)
- Drop `game_one_live_uq`.
- Add `create unique index game_join_code_live_uq on game.game (join_code) where status <> 'FINISHED'`.
- Existing prod data needs no change, because it has at most one live game.

### API (singleton routes removed, no compatibility shims)
| Route | Notes |
|---|---|
| GET `/api/admin/games` | All games, newest first, with player counts |
| POST `/api/admin/games` | 409 `JOIN_CODE_TAKEN` (index-backed, race-safe); replaces `LIVE_GAME_EXISTS` |
| GET/PATCH `/api/admin/games/{gameId}` | 404 `GAME_NOT_FOUND`; PATCH on FINISHED → 409 `GAME_FINISHED`; code change → `JOIN_CODE_TAKEN` |
| GET `/api/admin/games/{gameId}/players`, PATCH `.../players/{playerId}` | A player not in that game → 404 `PLAYER_NOT_FOUND` |
| POST/GET `/api/admin/games/{gameId}/rings`, GET `.../rings/current` | The shuffle locks that game's row (`findByIdForUpdate`) |
| GET `/api/join/{code}` | Preview `{gameId, name, signupsOpen, alreadyJoined}` for the live game with that code. An unknown code is 404 `BAD_JOIN_CODE` and counts towards the 5-failures-per-10-minutes limit, so codes can't be enumerated |
| POST `/api/players` `{joinCode, displayName}` | The code now finds the game; same errors as today |
| GET `/api/me` | `{email, isAdmin, games: [{game, player}]}`: every game the user plays in, including finished ones |
| GET `/api/me/games/{gameId}/target` | 404 `NO_TARGET` if the user is not playing in that game or has no target |

- `findLive`/`findLiveForUpdate` and `NO_LIVE_GAME` are removed.

### Web
- `/`: an admin sees the menu. A player goes to `/me` if they're in any game, otherwise to `/join`.
- `/me`: a list of the user's games (name, status, own status), each linking to `/games/[gameId]`.
- `/games/[gameId]`: the user's player info in that game, plus their target (this replaces `/target`).
- `/join`: a code form that redirects to `/join/[code]`.
- `/join/[code]`: the preview and a display-name form. If the user already joined, it redirects to `/games/[gameId]`.
- Login return:
  - The proxy keeps the original path as `?next=` on `/login`.
  - The login actions pass `next` through `safeNextPath`, both into `emailRedirectTo` (`/auth/confirm?next=`) and into the redirect at the end of the code login.
- `/admin`: the games list and the create form.
- `/admin/games/[gameId]`: settings, with the shareable join link and a copy button.
- `/admin/games/[gameId]/players` and `/admin/games/[gameId]/rings`: these pages render without edit controls when the game is FINISHED.
- Every admin page still calls `requireAdmin()`.

## Edge cases
- Two creates with the same code at the same moment: the index makes one fail with `JOIN_CODE_TAKEN`.
- Reusing a FINISHED game's code: allowed. The old game keeps it, and the link now goes to the new game.
- `/join/CODE` for a finished game or an unknown code shows "This join link isn't valid", and the attempt counts towards the limit.
- `/join/CODE` with signups closed shows the game name and a "signups closed" message, with no form.
- A crafted `next=` such as `//evil.com` is rejected by `safeNextPath`, which falls back to `/`.
- Mixing ids, for example a player id from game A used under game B's URL, returns 404.
- The display name only needs to be unique within each game, so the same name can be used in two games.

## Testing
- **ITs:**
  - Rewrite the affected ITs: AdminGame, Signup, Me, AdminPlayers, Ring and Target.
  - New cases:
    - two live games at once
    - code uniqueness and reuse after a game finishes
    - FINISHED games are read-only for every mutation
    - ids can't cross games
    - the preview endpoint and its limiter
    - one user playing in two games
- **Web unit:** api.ts, the error-message maps, and the `next` handling.
- **E2E:**
  - Update `full-flow` so players join through the link.
  - A new spec covers:
    - a logged-out visitor opens `/join/CODE`, logs in by magic link and is returned to the link
    - a second concurrent game whose player is in both games
    - finishing a game, which then shows as read-only in the list

## Rollout
- Merging to main deploys the API and the web at the same time.
- During the short gap between the two deploys, the old web against the new API (or the reverse) will show errors. That's acceptable at this scale.
- V2 runs on prod automatically.

## Open questions
None blocking.
