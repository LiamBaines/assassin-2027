# Kills tab

Move unresolved kill claims out of Players into a new admin "Kills" tab, with a count badge on the tab so the admin knows to resolve them.

## Assumptions
- Tab order: Leaderboard, Players, Kills, Settings, Log.
- The resolved-kills list (with "Change method") currently on Players also moves to Kills, below the claims. Players keeps the roster only (and per-row Register kill).
- Badge counts open claims (PENDING + CONTESTED), the same set `listOpenKillClaims` returns. Hidden at 0. Includes a screen-reader label ("3 unresolved kill claims").
- Badge is fetched in the game layout (a server component), so it refreshes on every action via the existing `revalidatePath("/", "layout")`. It adds one API call per admin game page.
- Claim row markup and all `data-testid`s (`kill-claims-heading`, `kill-claim`, `claim-method`, `kill-row`, `kill-method`) are kept as-is.

## Tasks
1. [x] Add `kills/page.tsx`: claims panel (moved from Players), resolved kills panel, and an empty state when there are neither. Calls `loadAdminGame` itself.
2. [x] Remove the claims and kills panels (and now-unused imports/fetches) from `players/page.tsx`.
3. [x] `game-nav.tsx`: add the Kills tab and an optional `openClaims` prop that renders the badge (blood colour, `tabular`). `layout.tsx` fetches the count via `listOpenKillClaims` and passes it.
4. [x] Add `kills/loading.tsx` if sibling tabs have one, otherwise rely on `[gameId]/loading.tsx`.
5. [x] Update `e2e/claims.spec.ts` and `e2e/kills.spec.ts` to navigate to the Kills tab; add an assertion for the badge count. Add a short `docs/progress.md` entry.
6. [x] Verify: `pnpm lint && pnpm typecheck && pnpm test`, then `./scripts/e2e.sh e2e/claims.spec.ts e2e/kills.spec.ts`.
