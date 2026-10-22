# Inbox UI refinements

## Context
The inbox thread view is cluttered (per-message role label and timestamp), scrolls as a whole page (composer can fall off-screen), and the conversation previews only update on reload even though the bottom-bar bubble polls.

## Decisions
- Remove the per-message "You" / "Your assassin" label and per-message `RelativeTime`. Alignment and colour carry the sender.
- Group messages into clusters: a new cluster starts when the gap to the previous message is over 10 minutes. Each cluster gets a centred timestamp above it (muted, `text-xs`, `tabular`), using `formatRelative`/`formatDateTime` from the existing time helpers.
- Thread view is a fixed-height column: header (back button + "Your target · {name}") fixed on top, scrollable messages in the middle, composer pinned at the bottom (also with zero messages; the empty-state text sits in the scroll region). Scroll to bottom on open and when a new message arrives.
- Target name shown only on the "Your target" thread (the assassin's identity stays secret). Passed as a `targetName` prop from `page.tsx` (`assignment.target.displayName`).
- Conversation list sorted by latest message, newest first; threads with no messages last. Messages inside a thread stay oldest to newest.
- Previews refresh live: new server action `getMessagesAction(gameId)` (wraps `getMyMessages`, read-only, no revalidate, null on API error like `getUnreadCountAction`). `Inbox` holds threads in state seeded from props, re-fetches every `UNREAD_POLL_MS` while visible and on `INBOX_CHANGED_EVENT`.

## Tasks
1. [x] Pure helpers in `lib/messages.ts` with Vitest in `messages.test.ts`: `clusterMessages(messages, gapMs)` and `sortThreads(threads)`.
2. [ ] `getMessagesAction` in `app/[gameId]/actions.ts`; `Inbox` state + polling; pass `targetName` from `page.tsx`.
3. [ ] Thread view redesign in `components/inbox.tsx`: no per-message labels/timestamps, cluster headers, header with target name, pinned composer, auto-scroll.
4. [ ] `game-shell.tsx`: when `view === "inbox"`, use a viewport-height layout (`h-dvh`, `min-h-0` main, room for the fixed bottom nav) so the inbox manages its own scrolling. Other views unchanged.
5. [ ] Update `e2e/messages.spec.ts` where needed (keep `data-testid`s: `message`, `message-body`, `message-send`, `inbox-thread-*`, `thread-unread`); add a check that a new message shows up in the list without reload. Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, then the messages e2e spec; check mobile viewport in Playwright.

Do one task at a time, stopping after each.

## Assumptions
- 10 minute cluster gap (constant), 30 s refresh interval reused.
- No API changes.
