"use server";

import { redirect } from "next/navigation";
import { createProfile, isApiError } from "@/lib/api";
import { safeNextPath } from "@/lib/safe-next";

export type WelcomeState = { error?: string; displayName?: string };

const MESSAGES: Record<string, string> = {
  INVALID_DISPLAY_NAME:
    "Your name must be 2–32 visible characters (an emoji counts as one).",
  VALIDATION_FAILED: "Your name must be 2–32 characters.",
};

/** Sets the display name for good, then continues to `next` (bound by the page). */
export async function setProfileAction(
  next: string,
  _prev: WelcomeState,
  formData: FormData,
): Promise<WelcomeState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  // Count code points like the API does, so an emoji is one character.
  const length = [...displayName].length;
  if (length < 2 || length > 32) {
    return { displayName, error: MESSAGES.VALIDATION_FAILED };
  }
  try {
    await createProfile(displayName);
  } catch (e) {
    // Already set (another tab, or a double submit): nothing to do but carry on.
    if (!isApiError(e, "PROFILE_EXISTS")) {
      if (isApiError(e)) {
        return { displayName, error: MESSAGES[e.code] ?? e.detail };
      }
      throw e;
    }
  }
  redirect(safeNextPath(next));
}
