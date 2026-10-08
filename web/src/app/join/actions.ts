"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isApiError, joinGame } from "@/lib/api";
import { normalizeJoinCode } from "@/lib/join-code";

export type JoinCodeState = { error?: string; joinCode?: string };

export type JoinState = {
  error?: string;
  code?: string;
  displayName?: string;
};

const MESSAGES: Record<string, string> = {
  SIGNUPS_CLOSED: "Signups for this game are closed.",
  BAD_JOIN_CODE: "This join link isn't valid any more. Check it with the organiser.",
  ALREADY_REGISTERED: "You're already registered for this game.",
  NAME_TAKEN: "Someone in this game already has that name. Pick another one.",
  INVALID_DISPLAY_NAME:
    "Your name must be 2–32 visible characters (an emoji counts as one).",
  TOO_MANY_ATTEMPTS:
    "Too many wrong join codes. Wait a few minutes and try again.",
  EMAIL_REQUIRED:
    "Your account has no email address. Sign out and sign in again with your email.",
  VALIDATION_FAILED: "Check your details: your name must be 2–32 characters.",
};

/** Plain /join: check the typed code's format, then open its join page. */
export async function goToJoinCodeAction(
  _prev: JoinCodeState,
  formData: FormData,
): Promise<JoinCodeState> {
  const raw = String(formData.get("joinCode") ?? "").trim();
  const joinCode = normalizeJoinCode(raw);
  if (!joinCode) {
    return { joinCode: raw, error: "The join code is 6–16 letters or numbers." };
  }
  redirect(`/join/${encodeURIComponent(joinCode)}`);
}

/** Signs up for the game behind `joinCode` (bound by the join page). */
export async function joinAction(
  joinCode: string,
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const echo = { displayName };

  // Count code points like the API does, so an emoji is one character.
  const nameLength = [...displayName].length;
  if (nameLength < 2 || nameLength > 32) {
    return {
      ...echo,
      code: "VALIDATION_FAILED",
      error: "Your name must be 2–32 characters.",
    };
  }
  const code = normalizeJoinCode(joinCode);
  if (!code) {
    return { ...echo, code: "BAD_JOIN_CODE", error: MESSAGES.BAD_JOIN_CODE };
  }

  let gameId: string;
  try {
    const joined = await joinGame({ displayName, joinCode: code });
    gameId = joined.game.id;
  } catch (e) {
    if (isApiError(e)) {
      return {
        ...echo,
        code: e.code,
        error: MESSAGES[e.code] ?? e.detail,
      };
    }
    throw e;
  }

  revalidatePath("/", "layout");
  redirect(`/games/${encodeURIComponent(gameId)}`);
}
