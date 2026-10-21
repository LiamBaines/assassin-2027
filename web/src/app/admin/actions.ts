"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/action-form";
import {
  addKillWords,
  changeKillMethod,
  confirmKillClaim,
  createGame,
  deleteKillWord,
  dismissKillClaim,
  getKillWordSuggestions,
  isApiError,
  registerKill,
  renamePlayer,
  requireAdmin,
  setPlayerStatus,
  shuffleRing,
  startRound,
  updateGame,
  type AdminGame,
  type PlayerRef,
  type UpdateGameRequest,
} from "@/lib/api";
import { normalizeJoinCode } from "@/lib/join-code";
import { parseKillMethods, readMethodId } from "@/lib/kill-methods";
import { parseWords, splitWordLines } from "@/lib/kill-words";
import { isUuid } from "@/lib/uuid";

// Every action checks that the caller is an admin first: server actions are public endpoints, so the admin pages'
// own requireAdmin() does not protect them. Actions that act on one game take its id as the first, bound argument,
// which the client can change, so it is checked too.

const INVALID_REQUEST: ActionResult = { error: "Invalid request." };

const MESSAGES: Record<string, string> = {
  JOIN_CODE_TAKEN:
    "Another game that hasn't finished already uses that join code. Pick another one.",
  GAME_NOT_FOUND: "That game doesn't exist. Go back to the games list.",
  GAME_FINISHED: "This game has finished, so it can't be changed.",
  VALIDATION_FAILED:
    "Check the form: the name is required and the join code is 6–16 letters or numbers.",
  NOT_ENOUGH_PLAYERS: "At least 2 players are needed to make a ring.",
  STALE_ROUND:
    "Someone else changed the ring since you loaded this page. Review the current ring and try again.",
  ROUND_ENDED: "The round has ended. Start a new round instead of shaking up.",
  NO_ROUND: "No round has started yet. Generate the first ring instead.",
  CONCURRENT_UPDATE:
    "Someone else changed this at the same time. The page has been refreshed; try again.",
  INVALID_STATUS: "That status change isn't allowed.",
  INVALID_DISPLAY_NAME:
    "A name must be 2–32 visible characters (an emoji counts as one).",
  DUPLICATE_NAMES:
    "Some players have the same display name. Rename them, then try again.",
  PLAYER_NOT_FOUND: "That player is no longer in the game. The page has been refreshed.",
  GAME_NOT_STARTED: "The game hasn't started yet. Generate a ring first.",
  PLAYER_NOT_ALIVE: "That player is already dead or removed. The page has been refreshed.",
  NOT_IN_RING: "That player isn't in the ring, so they can't be killed.",
  CLAIM_NOT_OPEN: "That claim has already been resolved. The page has been refreshed.",
  CLAIM_STALE:
    "The ring has changed since this claim was filed, so it's no longer valid. The page has been refreshed.",
  KILL_METHOD_REQUIRED: "Pick the kill method used.",
  KILL_METHOD_NOT_FOUND: "That kill method no longer exists. The page has been refreshed.",
  KILL_METHOD_DISABLED: "That kill method is disabled. Pick another one.",
  KILL_METHOD_NAME_TAKEN: "Two kill methods can't have the same name.",
  INVALID_KILL_METHOD: "Each kill method needs a name and zero or more points.",
  NO_ENABLED_METHODS: "At least one kill method must stay enabled.",
  KILL_NOT_FOUND: "That kill no longer exists. The page has been refreshed.",
  KILL_WORD_REQUIRED: "Enter at least one kill word.",
  KILL_WORD_TOO_LONG: "A kill word can be at most 60 characters.",
  KILL_WORD_TAKEN: "That word is already on the list or used twice. Each word must be unique.",
  KILL_WORD_BURNED: "That word has been used in this game before and can't be used again.",
  KILL_WORD_MISSING: "Every player needs a kill word.",
  KILL_WORD_PLAYER_INVALID: "A word was given to someone who isn't in this round. Review the players and try again.",
  KILL_WORD_NOT_AVAILABLE: "A picked word is no longer available. The page has been refreshed; pick again.",
  KILL_WORD_NOT_FOUND: "That word no longer exists. The page has been refreshed.",
  KILL_WORD_ALLOCATED: "That word has been given to a player, so it can't be deleted.",
  KILL_WORD_COUNT_INVALID: "Ask for between 1 and 200 words.",
  KILL_WORD_POOL_EXHAUSTED: "There aren't enough unused random words left. Add some yourself.",
  FORBIDDEN: "Your account isn't an admin, so it can't do that.",
};

/** Runs an API mutation, revalidates every page, and maps API errors. */
async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    if (isApiError(e)) {
      // Refresh anyway so a stale view (for example after STALE_ROUND) updates.
      revalidatePath("/", "layout");
      const error = MESSAGES[e.code] ?? e.detail;
      if (e.code === "DUPLICATE_NAMES" && Array.isArray(e.problem.players)) {
        return { error, duplicates: e.problem.players as PlayerRef[] };
      }
      return { error };
    }
    throw e;
  }
  revalidatePath("/", "layout");
  return {};
}

function readGameFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const joinCode = normalizeJoinCode(formData.get("joinCode"));
  if (!name) return { error: "Enter a game name." } as const;
  if (!joinCode) {
    return { error: "The join code must be 6–16 letters or numbers." } as const;
  }
  return { name, joinCode } as const;
}

export async function createGameAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const fields = readGameFields(formData);
  if ("error" in fields) return { error: fields.error };
  let game: AdminGame | undefined;
  const result = await run(async () => {
    game = await createGame(fields);
  });
  if (!game) return result;
  redirect(`/admin/games/${encodeURIComponent(game.id)}`);
}

export async function setSignupsAction(
  gameId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const patch: UpdateGameRequest = {
    signupsOpen: formData.get("signupsOpen") === "true",
  };
  return run(() => updateGame(gameId, patch));
}

export async function finishGameAction(gameId: string): Promise<ActionResult> {
  await requireAdmin();
  return run(() => updateGame(gameId, { status: "FINISHED" }));
}

export async function setPlayerStatusAction(
  gameId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "");
  const status = formData.get("status");
  if (!isUuid(playerId) || (status !== "ALIVE" && status !== "REMOVED")) {
    return INVALID_REQUEST;
  }
  return run(() => setPlayerStatus(gameId, playerId, status));
}

/** Renames a player for this game (the players page and the duplicate-names dialog). Resolves to an error or null. */
export async function renamePlayerAction(
  gameId: string,
  playerId: string,
  displayName: string,
): Promise<string | null> {
  await requireAdmin();
  const name = displayName.trim();
  const length = [...name].length;
  if (!isUuid(playerId) || length < 2 || length > 32) {
    return MESSAGES.INVALID_DISPLAY_NAME;
  }
  return (await run(() => renamePlayer(gameId, playerId, name))).error ?? null;
}

export async function registerKillAction(
  gameId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const victimId = String(formData.get("victimId") ?? "");
  const killMethodId = readMethodId(formData);
  if (!isUuid(victimId)) return INVALID_REQUEST;
  if (killMethodId === null) return { error: MESSAGES.KILL_METHOD_REQUIRED };
  return run(() => registerKill(gameId, victimId, killMethodId));
}

export async function changeKillMethodAction(
  gameId: string,
  killId: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(killId)) return INVALID_REQUEST;
  const killMethodId = readMethodId(formData);
  if (killMethodId === null) return { error: MESSAGES.KILL_METHOD_REQUIRED };
  return run(() => changeKillMethod(gameId, killId, killMethodId));
}

export async function shuffleRingAction(
  gameId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  // Empty means no ring has been generated yet; the API expects null in that case.
  const raw = formData.get("expectedCurrentRoundNo");
  const expected = raw ? Number(raw) : null;
  if (expected !== null && (!Number.isInteger(expected) || expected < 1)) {
    return INVALID_REQUEST;
  }
  const killMethods = parseKillMethods(formData);
  if (killMethods === null) return { error: MESSAGES.INVALID_KILL_METHOD };
  const words = parseWords(formData);
  if (words === null) return INVALID_REQUEST;
  return run(() => shuffleRing(gameId, expected, killMethods, words));
}

export async function startRoundAction(
  gameId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const expected = Number(formData.get("expectedRoundNo"));
  const playerIds = formData.getAll("playerIds").map(String);
  if (!Number.isInteger(expected) || expected < 1 || !playerIds.every(isUuid)) {
    return INVALID_REQUEST;
  }
  const killMethods = parseKillMethods(formData);
  if (killMethods === null) return { error: MESSAGES.INVALID_KILL_METHOD };
  const words = parseWords(formData, playerIds);
  if (words === null) return INVALID_REQUEST;
  return run(() => startRound(gameId, expected, playerIds, killMethods, words));
}

export async function confirmClaimAction(
  gameId: string,
  claimId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ActionForm passes (prev, formData) after the bound args
  _prev: ActionResult,
): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(claimId)) return INVALID_REQUEST;
  return run(() => confirmKillClaim(gameId, claimId));
}

export async function dismissClaimAction(
  gameId: string,
  claimId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ActionForm passes (prev, formData) after the bound args
  _prev: ActionResult,
): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(claimId)) return INVALID_REQUEST;
  return run(() => dismissKillClaim(gameId, claimId));
}

export async function addKillWordsAction(
  gameId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const words = splitWordLines(String(formData.get("words") ?? ""));
  if (words.length === 0) return { error: MESSAGES.KILL_WORD_REQUIRED };
  return run(() => addKillWords(gameId, words));
}

export async function deleteKillWordAction(
  gameId: string,
  wordId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ActionForm passes (prev, formData) after the bound args
  _prev: ActionResult,
): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(wordId)) return INVALID_REQUEST;
  return run(() => deleteKillWord(gameId, wordId));
}

/** Random words for the start dialogs; nothing is saved until the round starts. */
export async function suggestKillWordsAction(
  gameId: string,
  count: number,
): Promise<{ words: string[] } | { error: string }> {
  await requireAdmin();
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    return { error: INVALID_REQUEST.error! };
  }
  try {
    return { words: await getKillWordSuggestions(gameId, count) };
  } catch (e) {
    if (isApiError(e)) return { error: MESSAGES[e.code] ?? e.detail };
    throw e;
  }
}
