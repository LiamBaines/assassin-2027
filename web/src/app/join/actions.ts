"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isApiError, joinGame } from "@/lib/api";

export type JoinState = {
  error?: string;
  code?: string;
  displayName?: string;
  joinCode?: string;
};

const MESSAGES: Record<string, string> = {
  NO_LIVE_GAME: "There's no game running right now. Check back later.",
  SIGNUPS_CLOSED: "Signups for this game are closed.",
  BAD_JOIN_CODE: "That join code isn't right. Check it with the organiser.",
  ALREADY_REGISTERED: "You're already registered for this game.",
  NAME_TAKEN: "Someone already has that name. Pick another one.",
  INVALID_DISPLAY_NAME:
    "Your name must be 2–32 visible characters (an emoji counts as one).",
  TOO_MANY_ATTEMPTS:
    "Too many wrong join codes. Wait a few minutes and try again.",
  EMAIL_REQUIRED:
    "Your account has no email address. Sign out and sign in again with your email.",
  VALIDATION_FAILED:
    "Check your details: your name must be 2–32 characters and the join code 6–16 letters or numbers.",
};

export async function joinAction(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const joinCode = String(formData.get("joinCode") ?? "")
    .trim()
    .toUpperCase();
  const echo = { displayName, joinCode };

  // Count code points like the API does, so an emoji is one character.
  const nameLength = [...displayName].length;
  if (nameLength < 2 || nameLength > 32) {
    return {
      ...echo,
      code: "VALIDATION_FAILED",
      error: "Your name must be 2–32 characters.",
    };
  }
  if (!/^[A-Z0-9]{6,16}$/.test(joinCode)) {
    return {
      ...echo,
      code: "VALIDATION_FAILED",
      error: "The join code is 6–16 letters or numbers.",
    };
  }

  try {
    await joinGame({ displayName, joinCode });
  } catch (e) {
    if (isApiError(e)) {
      return {
        ...echo,
        code: e.code,
        error: MESSAGES[e.code] ?? "Something went wrong. Try again.",
      };
    }
    throw e;
  }

  revalidatePath("/", "layout");
  redirect("/me");
}
