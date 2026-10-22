import type { Message, MessageCounterpart, MessageThread } from "@/lib/api-types";

export const MESSAGE_MAX_LENGTH = 280;
export const UNREAD_POLL_MS = 30_000;
/** A gap longer than this between two messages starts a new cluster with its own timestamp. */
export const CLUSTER_GAP_MS = 10 * 60_000;
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

/** Splits oldest-first messages into clusters; a gap over `gapMs` to the previous message starts a new one. */
export function clusterMessages(messages: Message[], gapMs = CLUSTER_GAP_MS): Message[][] {
  const clusters: Message[][] = [];
  let prev: number | null = null;
  for (const m of messages) {
    const at = Date.parse(m.createdAt);
    if (prev === null || at - prev > gapMs) clusters.push([]);
    clusters[clusters.length - 1].push(m);
    prev = at;
  }
  return clusters;
}

/** Latest message first; conversations with no messages go last. */
export function sortThreads(threads: MessageThread[]): MessageThread[] {
  const latest = (t: MessageThread) =>
    t.messages.length ? Date.parse(t.messages[t.messages.length - 1].createdAt) : -Infinity;
  return [...threads].sort((a, b) => latest(b) - latest(a));
}
