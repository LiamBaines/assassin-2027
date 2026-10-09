"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/action-form";
import {
  acceptKillClaim,
  contestKillClaim,
  fileKillClaim,
  isApiError,
  withdrawKillClaim,
} from "@/lib/api";

// The game id and claim id are bound by the page, so the client can change them. The API checks the caller is the
// claim's killer or victim, so they need no check here.

const MESSAGES: Record<string, string> = {
  NOT_IN_GAME: "You aren't a player in this game.",
  GAME_NOT_STARTED: "The game hasn't started yet.",
  GAME_FINISHED: "This game has finished.",
  NO_TARGET: "You don't have a target right now.",
  CLAIM_ALREADY_OPEN: "There's already an open kill claim against your target.",
  CLAIM_NOT_OPEN: "That claim has already been resolved. The page has been refreshed.",
  CLAIM_STALE: "The ring has changed since this claim was filed, so it's no longer valid.",
  NOT_CLAIM_PARTICIPANT: "You can't respond to that claim.",
};

/** Runs an API mutation, revalidates every page, and maps API errors. */
async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    if (isApiError(e)) {
      // Refresh anyway so a stale view updates.
      revalidatePath("/", "layout");
      return { error: MESSAGES[e.code] ?? e.detail };
    }
    throw e;
  }
  revalidatePath("/", "layout");
  return {};
}

export async function fileClaimAction(
  gameId: string,
): Promise<ActionResult> {
  return run(() => fileKillClaim(gameId));
}

export async function withdrawClaimAction(
  gameId: string,
  claimId: number,
): Promise<ActionResult> {
  return run(() => withdrawKillClaim(gameId, claimId));
}

export async function acceptClaimAction(
  gameId: string,
  claimId: number,
): Promise<ActionResult> {
  return run(() => acceptKillClaim(gameId, claimId));
}

export async function contestClaimAction(
  gameId: string,
  claimId: number,
): Promise<ActionResult> {
  return run(() => contestKillClaim(gameId, claimId));
}
