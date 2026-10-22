"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/action-form";
import {
  acceptKillClaim,
  contestKillClaim,
  fileKillClaim,
  getUnreadMessageCount,
  isApiError,
  markMessagesRead,
  sendMessage,
  withdrawKillClaim,
} from "@/lib/api";
import { readMethodId } from "@/lib/kill-methods";
import type { MessageCounterpart } from "@/lib/api-types";

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
  KILL_METHOD_REQUIRED: "Pick the kill method you used.",
  KILL_METHOD_NOT_FOUND: "That kill method no longer exists. The page has been refreshed.",
  KILL_METHOD_DISABLED: "That kill method is disabled. Pick another one.",
  NOT_CLAIM_PARTICIPANT: "You can't respond to that claim.",
  INVALID_MESSAGE: "Messages must be 1 to 280 characters.",
  NO_ACTIVE_PAIRING: "That conversation has ended, so you can't send messages in it.",
  RATE_LIMITED: "You're sending too fast. Wait a minute and try again.",
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
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const killMethodId = readMethodId(formData);
  if (killMethodId === null) return { error: MESSAGES.KILL_METHOD_REQUIRED };
  return run(() => fileKillClaim(gameId, killMethodId));
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

export async function sendMessageAction(
  gameId: string,
  to: MessageCounterpart,
  body: string,
): Promise<ActionResult> {
  return run(() => sendMessage(gameId, to, body));
}

export async function markMessagesReadAction(
  gameId: string,
  thread: MessageCounterpart,
): Promise<ActionResult> {
  return run(() => markMessagesRead(gameId, thread));
}

/** Polled by the bottom bar. Read-only, so it doesn't revalidate; errors read as "no change". */
export async function getUnreadCountAction(gameId: string): Promise<number | null> {
  try {
    return (await getUnreadMessageCount(gameId)).unread;
  } catch (e) {
    if (isApiError(e)) return null;
    throw e;
  }
}
