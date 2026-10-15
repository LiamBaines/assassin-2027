# UI refinement (navigation, density, privacy)

## Context
Follow-up to `ui-overhaul.md`. Goals: professional, compact, dense admin, clear player views; GitHub/Vercel as references. Use the `frontend-design` skill. Keep all `data-testid`s (update e2e only where navigation changes).

## Decisions (Q&A + assumptions)
- Last-used view stored in **cookies** (no API/DB change). `last-area` = `admin|player`; `last-game` = game id. Set from server-side layouts/pages (or a tiny client effect if cookies can't be set in render; Server Action/route handler otherwise). Validate id via `uuid.ts`.
- `/` redirect: admin with `last-area=admin` -> `/admin`; else `/games/{last-game}` if it's still in `me.games`; else `/me` (or `/join` if none). Non-admins ignore `last-area`. Admin <-> player switch link stays in both shells so the choice is always reversible. `/me` remains as the full games list.
- Admin: sidebar kept for the **games list only**. Game screens use a top bar (back to Games, game name + status) with a tab row: Leaderboard (default), Players, Settings, Log. Overview/Details/Rings pages removed.
- Shakeup / start next round / generate ring: **"Round actions" menu in the Leaderboard header** next to the round dropdown, each opening a confirm dialog (reuse `StartRoundForm`, `KillMethodsEditor` logic from the Rings page; show current allocation info in the dialog). `rings/page.tsx` deleted; ring history UI dropped (not needed now).
- Settings tab: join link (copy/share), signups open/close, finish game, kill methods. Name and join code are edited via pencil icons, not here.
- Target is hidden on every load (local state only), eye icon toggles; fixed-size masked placeholder to avoid layout shift.
- Join codes use `font-mono` everywhere. Update the CLAUDE.md "no mono labels" rule: mono is for join codes only.
- Multi-option selectors (leaderboard rounds, etc.) become dropdowns (custom `Select` in `ui.tsx`/native styled select; keyboard accessible).
- Assumed: player log view already exists (`?view=log`, in hamburger menu); task 7 checks it is reachable and promotes it if buried.

## Tasks (one at a time; stop after each)
1. [x] Branch `ui-refinement`. Primitives: `font-mono` token, `JoinCode` component, `Select` dropdown, `InlineEdit` (pencil -> input with Enter/Escape, save/cancel, inline error), `RelativeTime` (short "2d ago", full date-time `title`/tooltip after short hover delay), clickable-row helper. Update CLAUDE.md UI rules.
2. [ ] Cookies + root redirect: record last area/game, rewrite `app/page.tsx`, handle stale game ids; unit-test the resolver in `lib/`.
3. [ ] Admin games list: whole-row click (keyboard-accessible, real link semantics), drop "at <date>" for finished games, relative Created, mono join codes, remove right-hand form; "New game" button top right opens `Dialog` with name/join code fields.
4. [ ] Admin game shell: top bar + tabs (`game-nav.tsx`, `layout.tsx`), remove sidebar on game routes, inline-editable name and join code in the header, default route -> Leaderboard (redirect from `/admin/games/{id}`), delete Details and Rings pages.
5. [ ] Leaderboard: round dropdown (admin and player), "Round actions" menu with shakeup/next round/generate ring dialogs, state-aware enable/disable.
6. [ ] Admin Players tab: kill method select appears only after "Register kill" is clicked (inline popover/row expand with confirm/cancel); denser table. Settings tab content per decisions.
7. [ ] Player: target hidden with eye toggle; same click-to-reveal kill-method flow; log reachable; round selectors as dropdowns; mono join code.
8. [ ] Update e2e specs for navigation changes; `pnpm lint`, `pnpm typecheck`, `pnpm test`, then `./scripts/e2e.sh` once; Playwright screenshots (390px player, 1440px admin) to critique; append `docs/progress.md`; squash-merge.

## Critical files
`web/src/app/page.tsx`, `app/admin/**`, `app/games/[gameId]/**`, `components/{ui,leaderboard,player-leaderboard,kill-method-select,start-round-form}.tsx`, `lib/format.ts`, `web/e2e/*`, `CLAUDE.md`.

## Verification
Unit tests for redirect resolver and relative-time formatting; lint/typecheck; e2e once at the end; manual Playwright checks of hover tooltip delay, keyboard row activation, and the stale-cookie fallback. Real-device touch is untested.
