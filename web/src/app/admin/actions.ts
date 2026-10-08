"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/action-form";
import {
  createGame,
  isApiError,
  setPlayerStatus,
  shuffleRing,
  updateGame,
  type UpdateGameRequest,
} from "@/lib/api";

const MESSAGES: Record<string, string> = {
  LIVE_GAME_EXISTS: "A game is already running. Refresh the page.",
  NO_LIVE_GAME: "There is no live game. Create one first.",
  VALIDATION_FAILED:
    "Check the form: the name is required and the join code is 6–16 letters or numbers.",
  IN_ACTIVE_RING: "Player is in the active ring — run a shakeup first",
  NOT_ENOUGH_PLAYERS: "At least 2 alive players are needed to make a ring.",
  STALE_ROUND:
    "Someone else changed the ring since you loaded this page. Review the current ring and try again.",
  GAME_FINISHED: "The game has finished.",
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
  const joinCode = String(formData.get("joinCode") ?? "")
    .trim()
    .toUpperCase();
  if (!name) return { error: "Enter a game name." } as const;
  if (!/^[A-Z0-9]{6,16}$/.test(joinCode)) {
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
  return run(() => createGame(fields));
}

export async function updateGameAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const fields = readGameFields(formData);
  if ("error" in fields) return { error: fields.error };
  return run(() => updateGame(fields));
}

export async function setSignupsAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const patch: UpdateGameRequest = {
    signupsOpen: formData.get("signupsOpen") === "true",
  };
  return run(() => updateGame(patch));
}

export async function finishGameAction(): Promise<ActionResult> {
  return run(() => updateGame({ status: "FINISHED" }));
}

export async function setPlayerStatusAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get("playerId") ?? "");
  const status = formData.get("status");
  if (!id || (status !== "ALIVE" && status !== "REMOVED")) {
    return { error: "Invalid request." };
  }
  return run(() => setPlayerStatus(id, status));
}

export async function shuffleRingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  // Empty means no ring has been generated yet; the API expects null in that case.
  const raw = formData.get("expectedCurrentRoundNo");
  const expected = raw ? Number(raw) : null;
  if (expected !== null && (!Number.isInteger(expected) || expected < 1)) {
    return { error: "Invalid request." };
  }
  return run(() => shuffleRing(expected));
}
