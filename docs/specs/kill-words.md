# Kill words (Death Sentence)

The assassin gets a word each round. If they make their target say it aloud, that's a Death Sentence kill.

## Decisions
- Applies only while the game's enabled kill methods include one named "Death Sentence" (case-insensitive). Otherwise no allocation step, no word on home.
- The word belongs to the **assassin**. It survives target changes (splices) within the round.
- Words are unique per game, case-insensitive, and phrases are allowed. Any allocated word stays burned forever (never reused), whether or not it was used in a kill.
- Admin keeps a per-game word list (add one or several, one per line; delete only while unallocated). It shows unused / allocated / used.
- Allocation is part of the atomic round start (`shuffle` for round 1, `startRound` for later rounds): the request carries `playerId -> word` for every included player. It fails if a word is missing, duplicated or already burned. Shakeups don't change words.
- The start dialog gets a words step per player: pick from the unused admin list, or a random button. A "fill remaining with random" button covers the rest. Random words come from a bundled curated list and skip words already burned in this game. A generate endpoint returns suggestions without persisting them.
- Admin can see every player's word, read-only after allocation.
- Player home: "Your kill word" with its own hold-to-reveal eye under the target. Hidden if Death Sentence is disabled or the player isn't alive. Once burned, it shows as used with no word for the rest of the round.
- A Death Sentence kill (claim and admin register) is rejected with a clear error code if the assassin has no live word. On a confirmed kill the assassin's word is marked used.

## Tasks
1. [x] Flyway migration: `kill_word` table (game_id, text, normalised unique per game, state, origin admin/random, allocated assignment/player + round, used_at, created_at), with RLS and grants as in V9. Entity, repository and service for word list CRUD with validation. Admin endpoints: list, add, delete-unallocated. ITs.
2. [x] Random generator: bundled word list resource, `generate(gameId, n)` skipping burned words. Admin endpoint for suggestions. Unit test.
3. [x] Allocation in `shuffle` and `startRound`: accept and validate `words` map, persist atomically, ignore when Death Sentence is disabled. Error codes. ITs (round 1, round 2, missing word, duplicate word, burned word, disabled method).
4. [x] Burn on kill: Death Sentence claim and admin register check the assassin has a live word, and mark it used on kill. Error code. ITs.
5. [x] Player API and home UI: word in the `/api/me/games/{gameId}/target` response (or a sibling), plus the eye-reveal component, reusing the target's reveal behaviour. Vitest and e2e testids.
6. [ ] Admin UI: Kill words tab (list, add, delete) plus the words step in the start-round dialogs (per-player pick/random, fill remaining). Admin player table shows the word. Empty, loading and error states.
7. [ ] E2E spec for the full flow. Full test suite, update `docs/progress.md`.

## Open assumptions
- Kill-method matching is by name ("Death Sentence"), since methods are admin-editable rows. If the admin renames it, the feature turns off.
