import type { MessageCounterpart } from "@/lib/api-types";

export const MESSAGE_MAX_LENGTH = 280;
export const UNREAD_POLL_MS = 30_000;
/** Fired on window when the player reads or sends, so the bar bubble refreshes at once. */
export const INBOX_CHANGED_EVENT = "inbox:changed";

/** Bubble text (count, "9+" cap) and an accessible name that carries the status too. */
export function unreadBadge(count: number): { text: string | null; label: string } {
  if (count <= 0) return { text: null, label: "Inbox" };
  return {
    text: count > 9 ? "9+" : String(count),
    label: `Inbox, ${count} unread ${count === 1 ? "message" : "messages"}`,
  };
}

export function threadTitle(withRole: MessageCounterpart): string {
  return withRole === "TARGET" ? "Your target" : "Your assassin";
}

/** Trimmed body is valid when 1 to MESSAGE_MAX_LENGTH characters. */
export function isValidBody(body: string): boolean {
  const n = body.trim().length;
  return n >= 1 && n <= MESSAGE_MAX_LENGTH;
}
