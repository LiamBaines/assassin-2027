# Custom dropdowns

Replace the native `<select>` with a custom dropdown styled like the "Round actions" menu. This covers every dropdown, in player and admin views, on mobile and desktop.

## Scope

There is one native `<select>`, the `Select` primitive in `web/src/components/ui.tsx`. It has three call sites:
- `kill-method-select.tsx` is the `KillMethodSelect` form field. It is used by `register-kill.tsx` (two places, player view) and `admin/games/[gameId]/kills/page.tsx`.
- `round-select.tsx` is the leaderboard view picker. It is used by `player-leaderboard.tsx` (player) and `AdminRoundSelect` (admin).

## Assumptions

- The panel reuses the Round actions menu styling: `rounded-panel border border-line bg-surface`, `divide-y`, and item hover `bg-raised`. It is anchored under the trigger and as wide as the trigger, with a minimum width.
- The trigger is the field style the native select has now (`bg-raised`, border, chevron). It is not `secondaryButtonClass`.
- The selected option shows a `Check` icon.
- A small viewport uses the same anchored popover, with 44px-high items for touch. I'm not adding a bottom sheet.
- Behaviour is the same on mobile and desktop.

## Tasks

1. [x] Add a client `Select` in `web/src/components/select.tsx`, or in `ui.tsx` if it stays server-safe via a client child.
   - API: `options: {value, label, disabled?}[]`, `value`/`defaultValue`, `onChange(value)`, `name`, `required`, `placeholder`, `aria-label`, `data-testid`, `className`.
   - Form integration: render a hidden `<input name>` so server actions still receive `killMethodId`.
   - `required` is enforced by a visually hidden, focusable `required` input, or by validating on submit.
   - ARIA is `listbox`/`option` or the existing `menu` pattern. It supports Escape, outside pointerdown, arrow keys, Home/End, Enter/Space, and typeahead if cheap.
   - Flip upward when there is no room below. The panel is scrollable with a max height.
2. [x] Migrate `KillMethodSelect` and `RoundSelect`. Remove the `<option>` children.
3. [x] Update the e2e helpers to the new interaction, and keep the `data-testid`s.
   - `e2e/support.ts:130` (kill method pick) and `e2e/rounds.spec.ts:116-117` (leaderboard view) currently use `selectOption`.
   - The new interaction is: click the trigger, then click the option by role and name.
4. [x] Verify: `pnpm lint`, `pnpm typecheck`, `pnpm test`, then `./scripts/e2e.sh` once. Check a mobile viewport and a desktop viewport with Playwright for the clipped-panel case, e.g. inside the Sheet/Dialog.

## Risks

- The panel could be clipped by `overflow` in Sheet/Dialog or by the table in the Kills tab. Fix this by portaling the panel or by using fixed positioning.
- Native form validation messages for `required` need a replacement.
