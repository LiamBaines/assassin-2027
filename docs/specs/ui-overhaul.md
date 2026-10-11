# UI overhaul (dark, utilitarian)

## Context
Current UI is default light zinc/Tailwind cards. Goal: dark, sleek, professional, high information clarity; player = mobile-first, admin = desktop-first; instant in-page navigation; icons over words; one icon set; documented in CLAUDE.md. `frontend-design` skill is available (loaded).

Decisions (Q&A): crimson accent; client-side views in one page (URL kept in `?view=`); Lucide icons + new type pairing; keep all `data-testid`s, update e2e specs only where navigation changes.

## Design plan (frontend-design pass 1, reviewed)
**Colour** (CSS variables via Tailwind v4 `@theme`):
- `ink` #0E0D0D base, `surface` #171515 panels, `raised` #211E1E, `line` #2E2A2A
- `bone` #E9E4DC text, `muted` #8F8883
- `blood` #B3262F accent (primary actions, the target). Status: alive = `#4E9F6B` muted green, eliminated = muted grey + strikethrough/skull icon, warning = amber `#C8963E`. Red is never the only status signal (icon + label too).
**Type:** display = a condensed grotesk (e.g. Barlow Condensed / Oswald-class) for target name, status, headings; UI/body = Inter-class sans; tabular numerals for scores. Sentence case, no all-caps eyebrows, no mono labels.
**Layout:**
- Player (mobile, max-w-md centred on desktop): top bar = game name + round + hamburger. Hero = TARGET name huge, left-aligned, with kill-registration action pinned below; status chip (alive/dead) directly under. Incoming-claim alert sits above hero (urgent). Bottom bar: Target / Players / Leaderboard (icons + short label). Hamburger sheet: past rounds, my games, admin (if admin), sign out.
- Admin (desktop): fixed left sidebar (games list, current game sections: Overview, Players, Rings, Leaderboard; icons+labels, collapsing to icon rail/drawer on mobile). Dense tables, right-aligned numbers, sticky headers, inline row actions as icon buttons with tooltips.
- Panels: flat, 1px `line` border, small radius (4–6px) for controls, 0 for table rows; *no* shadows, no nested cards, no gradients/glow. Dividers over boxes where possible.
**Principle / the one memorable thing:** the target name set huge in condensed type on near-black, a single crimson rule beneath it. Everything else quiet.
**Review vs. brief:** dropped initial "crimson glow on target" (neon tell) and "all-caps tracking labels" (default chrome); kept restraint so crimson appears only on target/primary/destructive.
**Motion:** none on load; only action feedback (sheet open/close, button pending, toast); respect `prefers-reduced-motion`.
**States:** every list/panel gets empty, loading (skeleton via `loading.tsx`/`Suspense`), and error states with a next action. Real copy (no lorem/fake names). Confirm dialogs for destructive actions.

## Tasks (one at a time; stop after each)
1. [x] Branch `ui-overhaul`. Add `lucide-react`; fonts in `layout.tsx`; tokens in `globals.css`; rewrite `components/ui.tsx` primitives (Panel, Button variants, Input, Badge/StatusChip, Alert, EmptyState, Skeleton, IconButton w/ aria-label+tooltip, Sheet, Dialog). Update CLAUDE.md with a "UI design language" section (tokens, rules, anti-patterns list from the brief, Lucide-only, testid preservation). Commit.
2. [x] Auth + join + landing (`login`, `join`, `join/[code]`, `page.tsx`, `error.tsx`, `me`): restyle, error/empty states.
3. [x] Player game view: single client shell with views (`?view=target|players|leaderboard|rounds`), bottom bar + hamburger sheet; merge `games/[gameId]/leaderboard` into it (keep route redirecting). Target hero, status, claim flows, empty/loading/error.
4. [x] Admin shell: sidebar layout (`admin/layout.tsx`, `games/[gameId]/layout.tsx`, `game-nav.tsx`), games list (`admin/page.tsx`), responsive collapse.
5. [x] Admin panels: overview, players (table + icon actions), rings, leaderboard, start-round, kill-methods editor, copy/share buttons → icons.
6. [x] Update e2e specs for changed navigation; run `pnpm lint`, `pnpm typecheck`, `pnpm test`, then `./scripts/e2e.sh` once; Playwright screenshots at 390px and 1440px for each main screen to critique; append entry to `docs/progress.md`; squash-merge.

## Critical files
`web/src/components/ui.tsx`, `web/src/app/{layout.tsx,globals.css}`, `web/src/app/games/[gameId]/page.tsx`, `web/src/app/admin/**`, `web/src/components/*`, `web/e2e/*`, `CLAUDE.md`.

## Verification
Unit: `pnpm test`; static: `pnpm lint && pnpm typecheck`; e2e once at end via `./scripts/e2e.sh`; visual check with Playwright screenshots (mobile 390×844 player, desktop 1440×900 admin), including empty/error states and keyboard focus visibility. Anything not verifiable (e.g. real-device touch) is reported as untested.
