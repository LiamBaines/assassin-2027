# Profile display name (set once, per user)

## Context
Display name is currently typed on every game join and stored on `game.player` (unique per game). It should be set once at first login, live on the user's profile, and be reused for every game. Name clashes are no longer blocked at signup; they're resolved by the admin when starting a round.

## Design
- New `game.profile (auth_user_id uuid pk, display_name text 2-32 chars, created_at)`. Set once; no user-facing edit.
- `game.player.display_name` stays as the **effective in-game name**: copied from the profile at join. An admin rename changes only this column, so it acts as the per-game alias. Players never see that it differs.
- Drop `player_game_display_name_uq`. Signup no longer takes a name or returns `NAME_TAKEN`.
- Starting a round (`RingService.startRound`, and the initial allocation if it applies) returns 409 `DUPLICATE_NAMES` (with the clashing players) when selected players share a name case-insensitively. The admin renames one or both, then retries.
- Admin can rename any player at any time (extend `PATCH /api/admin/games/{gameId}/players/{playerId}` with optional `displayName`; keeps the existing validation).
- First login: any user without a profile is redirected to `/welcome?next=…` (via `safeNextPath`) before anything else, admins included. Join page drops the name field.

## Tasks
1. [x] API: migration V15 (create `profile`, backfill from each user's earliest `player` row, drop per-game unique index); `Profile` entity/repo; `GET/PUT /api/me/profile` (PUT 409 `PROFILE_EXISTS` if already set); `GET /api/me` returns `profile: {displayName} | null`. ITs.
2. [ ] API: signup uses profile name (400 `PROFILE_REQUIRED` if none); `SignupRequest` loses `displayName`. Update `SignupIT`, `JoinPreviewIT`, test helpers that sign up.
3. [ ] API: admin rename via PATCH + `DUPLICATE_NAMES` check on round start/allocation. ITs.
4. [ ] Web: `/welcome` page + action, redirect when `me.profile` is null (guard in the player/admin entry points that call `getMe`), join form/action/error map without name, `api-types.ts`, `api.ts`, unit tests.
5. [ ] Web: admin players page inline rename (`InlineEdit`); start-round form shows duplicate-name dialog (`Dialog`) with rename inputs, then retries. Error map in `admin/actions.ts`.
6. [ ] E2E: update `web/e2e` helpers (`pageFor`, `joinThroughLink`) to set the name at first login; keep all `data-testid`s. Append to `docs/progress.md`; note the decision in `docs/architecture.md`.

Each task is done one at a time, with the narrowest test, then stop.

## Verification
`./mvnw verify` (needs Docker/Colima), `pnpm lint && pnpm typecheck && pnpm test`, `./scripts/e2e.sh` once at the end.

## Assumptions
- Admin rename edits the per-game name only, never the profile.
- A user with no email/profile can't join until the name is set.
