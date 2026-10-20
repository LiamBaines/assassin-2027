# Consistent action dialogs

## Context
"Register kill" on the player view swaps the button for an inline form. The admin Players tab "Remove" does the same via `ConfirmSubmit` (inline message + Confirm + Cancel link). Both look rough and differ from the Shake up / Start next round / New game dialogs. Goal: one dialog language for every confirm-or-short-form action.

## Findings
- `components/register-kill.tsx`: admin variant already uses `Dialog`; player variant (`labelled`) is the inline form.
- `components/action-form.tsx` `ConfirmSubmit`: inline two-step. Used for Remove (players page), Confirm kill (kills page), Finish game (settings page).
- Footers are inconsistent: `round-actions.tsx` and `register-kill.tsx` use an underlined "Cancel" link; `new-game-dialog.tsx` uses `secondaryButtonClass`.
- `Dialog` (`components/overlay.tsx`) has only a title and a free body.

## Design (existing tokens only: ink/surface/raised/line/bone/muted/blood, font-display headings, flat 1px borders, no shadow/gradient)
Shared anatomy for all dialogs:
1. Header: font-display title, optional one-line muted description under it (`description` prop on `Dialog`).
2. Body: the form fields or context.
3. Footer (`DialogActions` in `overlay.tsx`): top divider, right-aligned, `secondaryButtonClass` Cancel + one primary (`primaryButtonClass`) or destructive (`dangerButtonClass`) submit. Full-width stacked buttons on mobile.
- Register kill: danger submit "Register kill", description names the victim/target, body is `KillMethodSelect`. Icon-free body; the `Crosshair` stays on the trigger.
- Remove player: `ConfirmSubmit` opens a `Dialog` ("Remove {name}?" plus the existing `removePlayerMessage`) with Cancel and a danger "Remove" button.
- Trigger buttons stay as-is (player: labelled primary button; admin: icon buttons). No inline swap anywhere.

## Tasks
1. [x] `overlay.tsx`: add `description` prop to `Dialog` and a `DialogActions` footer component.
2. [x] `register-kill.tsx`: drop the inline `labelled` branch; always use the dialog, keep `labelled` only for trigger styling. Use `DialogActions`.
3. [ ] `action-form.tsx` `ConfirmSubmit`: render a `Dialog` (inside the form, so the submit still posts it) instead of inline text. Add optional `title`; close on submit and on cancel. This also converts Confirm kill and Finish game.
4. [ ] `round-actions.tsx` and `new-game-dialog.tsx`: switch to `DialogActions` so every footer matches.
5. [ ] Update callers for the new `ConfirmSubmit` title (players, kills and settings pages).
6. [ ] Check e2e specs and unit tests for the inline flow (testids, "Cancel"/"Remove" click sequences) and adjust them; keep every `data-testid`.

One task at a time: I'll stop after each and wait.

## Verification
- `pnpm lint`, `pnpm typecheck`, `pnpm test` in `web/`.
- Playwright (MCP) screenshots at mobile and desktop widths: player Register kill dialog, admin Remove dialog, plus Shake up / New game for comparison. Check Esc, backdrop click, focus trap and the pending state.
- Run `./scripts/e2e.sh` once at the end.
