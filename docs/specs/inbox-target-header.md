# Inbox thread header: two-line target name

Mockup: `docs/mockups/inbox-target-header.html` (option C).

## Design
- Thread header becomes two lines: small muted label ("Your target" / "Your assassin") above the name in `font-display`. No separator needed.
- Mask (`••••••`) and real name share one grid cell, so the width never changes on hold. Long names truncate.
- Eye button pinned far right of the header, as on the homepage.
- Roles with no name (e.g. admin thread) keep a single-line title.

## Tasks
- [x] 1. Rework `HiddenName` in `web/src/components/target-reveal.tsx` to the stacked-slot layout (keep `testId` on the revealed name).
- [x] 2. Update the header in `web/src/components/inbox.tsx` (~line 218): label above, name below, eye far right; admin thread unchanged.
- [x] 3. Run `pnpm lint`, `pnpm typecheck`, `pnpm vitest run`, and check `duel-reveal` e2e usage still matches.
- [x] 4. Delete the mockup file.

## Assumptions
- `HiddenName` is only used by the inbox header (to be confirmed in task 1).
