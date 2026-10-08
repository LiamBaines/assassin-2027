# ADR 0003: Multiple games, joined by link

**Status:** accepted (2026-10-08). Replaces the "one live game at a time" rule.

## Decision
- **Several games can be live at once.** V2 drops the `game_one_live_uq` index. Every game-scoped route takes the game id in its path (`/api/admin/games/{gameId}/…`, `/api/me/games/{gameId}/target`), and there is no "current game" any more.
- **Join codes:**
  - The admin still types the code.
  - A code is unique among non-FINISHED games (`game_join_code_live_uq`), so it identifies the game a player is joining. A lost race returns 409 `JOIN_CODE_TAKEN`.
  - A finished game's code can be reused, because only live games are looked up by code.
- **One account can play in several games.** `/api/me` returns every game the user plays in, and the web lists them on `/me`.
- **Finished games are read-only and kept.** The admin can still view them. Every admin write to one returns 409 `GAME_FINISHED`, checked under the game row lock. There is no reopen and no delete.
- **Join links:**
  - `/join/CODE` previews the game (`GET /api/join/{code}`) and asks only for a display name.
  - Logged-out visitors go through `/login?next=…` and come back to the link. The magic-link template passes `{{ .RedirectTo }}` as `redirect_to`, and `/auth/confirm` reads `next` from it through `safeNextPath`.

## Why
- Admins want to run several games and look back at past ones.
- Typing a code is the main friction when joining.
- Scoping by id in the URL makes each request explicit and keeps one game's ids from working against another.

## Consequences
- **Join codes can be guessed through the preview.** The preview and signup draw on one shared limit for wrong codes, 5 per account per 10 minutes, and an unknown code gives the same 404 as a finished one.
- **Prod Supabase needs two manual settings:**
  - The magic-link template's link must be `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}`.
  - The redirect allowlist must include `https://assassin-2027.vercel.app/**`.
  - Otherwise magic links land on `/`, although code login still returns the user correctly.
- **Finishing a game leaves its assignments ACTIVE.** The web hides the target on a finished game.
