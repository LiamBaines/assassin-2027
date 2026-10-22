# Anonymous messaging

An assassin and their target can message each other without revealing who they are. Either side can start.

## Decisions
- A thread belongs to an **assignment** (assassin to target). When the assignment ends (kill, shakeup, new round, player leaves), the thread ends too. The assassin's new assignment after a kill starts empty.
- Players see two conversations: "Your target" and "Your assassin". Messages show only the role, never a name. A player's own assignment as target is the "Your assassin" thread, so it survives until that assignment ends.
- Ended threads are hidden from players and kept in the DB for admins. Nothing carries over between assignments.
- Send is allowed only while the assignment is ACTIVE. Both ends are then ALIVE. Otherwise 409 with a clear error code (`NO_ACTIVE_PAIRING`).
- Plain text, trimmed, 1 to 280 characters. Rate limit: 5 messages per minute per sender per assignment (`RATE_LIMITED`, 429).
- Unread is per message (`read_at`, set when the recipient opens the thread). No realtime, email or push.
- The unread count is polled (every 30 s while the tab is visible, plus on navigation and after sending). The web app reaches it only through the Spring API, server-side (Server Actions / route handler), like all game data.
- Admins can list a game's messages with real player names and delete a message. Admins don't send.
- Player UI: new Inbox icon in the bottom bar with an unread bubble (count, "9+" cap; status also in the aria-label, never colour alone). The bar then has five items (Target, Players, Leaderboard, Game log, Inbox). Inbox view has two conversation entries, a thread view with a composer, and empty, loading and error states.

## Tasks
1. [x] Flyway migration: `game.message` (id, game_id, assignment_id fk, sender_id, body with length check, created_at, read_at, deleted_at), RLS on and grants revoked as in V14. Entity, repository, `MessageService` (send with eligibility and rate limit, list threads, mark read, unread count). Unit tests and ITs (both directions, ended assignment, dead player, rate limit, length, ended threads hidden, new assignment starts empty after a kill).
2. [ ] Player endpoints under `/api/me/games/{gameId}/messages`: GET threads, POST send, POST read, GET unread-count. Error codes. ITs for auth and `NOT_IN_GAME`.
3. [ ] Admin endpoints: GET `/api/admin/games/{gameId}/messages` (with names and assignment status) and DELETE a message. ITs for the admin check.
4. [ ] Web data layer: `api.ts` calls, `api-types.ts`, error-code messages in `src/app/[gameId]/actions.ts`, Vitest for the API client.
5. [ ] Player UI: Inbox view in `game-shell.tsx` (fifth bar item with bubble), thread list, thread view with composer, polling of the unread count, empty/loading/error states. Vitest and `data-testid`s.
6. [ ] Admin UI: Messages tab in the game nav (list, delete, empty and error states).
7. [ ] E2E spec: assassin sends, target sees the bubble, replies, kill ends the thread. Full test suite, update `docs/progress.md`.

## Open assumptions
- One ACTIVE assignment per player as assassin and one as target (as today), so there are at most two live threads each.
- A rate limit of 5 per minute and a 280 character cap are starting values; they're constants, easy to change.
- Deleted messages are soft-deleted and disappear for players too.
