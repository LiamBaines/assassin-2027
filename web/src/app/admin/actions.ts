"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/action-form";
import {
  createGame,
  isApiError,
  setPlayerStatus,
  shuffleRing,
  updateGame,
  type AdminGame,
  type UpdateGameRequest,
} from "@/lib/api";
import { normalizeJoinCode } from "@/lib/join-code";

// Actions that act on one game take its id as the first, bound argument.

const MESSAGES: Record<string, string> = {
  JOIN_CODE_TAKEN:
    "Another game that hasn't finished already uses that join code. Pick another one.",
  GAME_NOT_FOUND: "That game doesn't exist. Go back to the games list.",
  GAME_FINISHED: "This game has finished, so it can't be changed.",
  VALIDATION_FAILED:
    "Check the form: the name is required and the join code is 6–16 letters or numbers.",
  NOT_ENOUGH_PLAYERS: "At least 2 alive players are needed to make a ring.",
  STALE_ROUND:
    "Someone else changed the ring since you loaded this page. Review the current ring and try again.",
  CONCURRENT_UPDATE:
    "Someone else changed this at the same time. The page has been refreshed; try again.",
  INVALID_STATUS: "That status change isn't allowed.",
  PLAYER_NOT_FOUND: "That player is no longer in the game. The page has been refreshed.",
};

/** Runs an API mutation, revalidates every page, and maps API errors. */
async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    if (isApiError(e)) {
      // Refresh anyway so a stale view (for example after STALE_ROUND) updates.
      revalidatePath("/", "layout");
      return { error: MESSAGES[e.code] ?? e.detail };
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
  const fields = readGameFields(formData);
  if ("error" in fields) return { error: fields.error };
  let game: AdminGame | undefined;
  const result = await run(async () => {
    game = await createGame(fields);
  });
  if (!game) return result;
  redirect(`/admin/games/${encodeURIComponent(game.id)}`);
}

export async function updateGameAction(
  gameId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const fields = readGameFields(formData);
  if ("error" in fields) return { error: fields.error };
  return run(() => updateGame(gameId, fields));
}

export async function setSignupsAction(
  gameId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const patch: UpdateGameRequest = {
    signupsOpen: formData.get("signupsOpen") === "true",
  };
  return run(() => updateGame(gameId, patch));
}

export async function finishGameAction(gameId: string): Promise<ActionResult> {
  return run(() => updateGame(gameId, { status: "FINISHED" }));
}

export async function setPlayerStatusAction(
  gameId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const playerId = String(formData.get("playerId") ?? "");
  const status = formData.get("status");
  if (!playerId || (status !== "ALIVE" && status !== "REMOVED")) {
    return { error: "Invalid request." };
  }
  return run(() => setPlayerStatus(gameId, playerId, status));
}

export async function shuffleRingAction(
  gameId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  // Empty means no ring has been generated yet; the API expects null in that case.
  const raw = formData.get("expectedCurrentRoundNo");
  const expected = raw ? Number(raw) : null;
  if (expected !== null && (!Number.isInteger(expected) || expected < 1)) {
    return { error: "Invalid request." };
  }
  return run(() => shuffleRing(gameId, expected));
}
