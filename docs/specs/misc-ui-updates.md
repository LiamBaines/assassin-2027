# Misc UI updates

Batch of UI fixes across player and admin views. Web-only except task 14 (small API change). Paths are under `web/src/`. Keep every `data-testid`; update e2e specs where UI is removed. One task at a time.

## Tasks
- [x] 1. **Dead chip**: remove `line-through` from the `dead` tone in `components/ui.tsx`.
- [x] 2. **Player header**: `app/[gameId]/game-shell.tsx` shows game name + `Round N` only; drop `playerName` prop and `player-name` span (update `page.tsx`, e2e).
- [x] 3. **Remove Players tab and Past rounds menu item**: drop `players`/`rounds` views from `game-shell.tsx` and `app/[gameId]/page.tsx`, plus now-unused fetches/imports (`getGamePlayers`, `getMyRounds`, etc.).
- [x] 4. **Leaderboard header**: remove the "Leaderboard" h2; one row "Leaderboard · Overall ⌄" with the `Select` as a subtle button-style trigger (`player-leaderboard.tsx`, `select.tsx`). Table headers in `components/leaderboard.tsx`: `# Player P BP K D Status`, with full names via `title`/`sr-only`.
- [x] 5. **Player log text**: `lib/game-event.ts` `describeEvent` takes an audience. Player: "Y was killed (method)"; admin keeps "X killed Y (method)". `EventLog` takes `audience`. Update unit tests.
- [x] 6. **Home buttons**: Register kill and Propose duel share the full width (2-col grid, `w-full`, same text size); a lone button spans full width. (`page.tsx`, `register-kill.tsx`, `duel-card.tsx`)
- [x] 7. **Inbox privacy**: `components/inbox.tsx` titles become "Your target" / "Your assassin". In the thread header, any known name is hidden behind an eye button using `useHoldReveal` (`target-reveal.tsx`). Keep the `duel-reveal` testid on the revealed name.
- [x] 8. **Empty-chat copy**: TARGET thread reads "…only that it's from their assassin." Verify the ASSASSIN wording is still right.
- [x] 9. **Chat composer**: one row with a small `Swords` icon button (`duel-challenge`), a `resize-none` textarea, and a round Send icon button (`message-send`) rendered only once there is valid text. Show the counter only near the limit.
- [x] 10. **My games hamburger**: `PlayerShell` always shows a hamburger opening a `Sheet` (Admin console for admins, replacing the shield icon, plus Sign out).
- [x] 11. **Admin Players table**: vertically centred cells, smaller/subtler pencil in `inline-edit.tsx`, Register kill icon-only, current target hidden behind a hold-eye (new `HiddenName` on `useHoldReveal`).
- [x] 12. **Remove admin Kills tab**: `game-nav.tsx` (move the open-claims badge to Log), delete `kills/page.tsx`, fix links, update e2e (`kills`, `claims`, `duels` specs).
- [x] 13. **Pending panel on Log**: `log/page.tsx` shows open claims (confirm/dismiss) and open duels (resolve), moved from the kills page, above `EventLog`.
- [x] 14. **Editable kills in log**: add `killId` to the `KILL` event data in `api/.../targeting/KillService.java` (+ IT assertion). Admin `EventLog` renders an inline `KillMethodSelect` + save (`changeKillMethodAction`) on KILL events with a `killId`; older events stay read-only.
- [x] 15. **Kill words input**: client component with single-line inputs, a new empty one appended once the last has text, no resize. `addKillWordsAction` reads `formData.getAll("words")`. Remove the explanatory paragraph before "Add words". Keep `kill-words-input` testid on the first input.

## Verification
Per task: narrow `pnpm vitest run <file>`, `pnpm typecheck`, `pnpm lint`; check UI in Playwright at mobile (player) and desktop (admin). End of batch: `pnpm test`, `./mvnw verify` (task 14), `./scripts/e2e.sh` once.

## Notes
The player events API payload still includes the killer; task 5 hides it in the UI only.
