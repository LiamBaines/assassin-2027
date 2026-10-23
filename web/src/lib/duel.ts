import type { AdminDuel, Duel, DuelStatus, KillMethod, Message } from "@/lib/api-types";

export const DUEL_ACTIVITY_MAX_LENGTH = 80;

const OPEN: DuelStatus[] = ["PENDING", "ACCEPTED", "REPORTED", "CONTESTED"];

export function isDuelOpen(status: DuelStatus): boolean {
  return OPEN.includes(status);
}

/** Trimmed activity is valid when 1 to DUEL_ACTIVITY_MAX_LENGTH characters. */
export function isValidActivity(activity: string): boolean {
  const n = activity.trim().length;
  return n >= 1 && n <= DUEL_ACTIVITY_MAX_LENGTH;
}

/** A duel is in play when an enabled kill method is named "Duel", case-insensitive. */
export function duelInPlay(methods: KillMethod[]): boolean {
  return methods.some((m) => m.enabled && m.name.trim().toLowerCase() === "duel");
}

/** The caller's own unresolved challenge, if any, in a thread's messages. */
export function myOpenChallenge(messages: Message[]): Duel | null {
  for (const m of messages) {
    if (m.duel && m.duel.challengerIsMe && isDuelOpen(m.duel.status)) return m.duel;
  }
  return null;
}

export type DuelAction = "accept" | "decline" | "revoke" | "report" | "confirm" | "contest";

/** Which buttons the viewer gets on a duel card. */
export function duelActions(duel: Duel): DuelAction[] {
  switch (duel.status) {
    case "PENDING":
      return duel.challengerIsMe ? ["revoke"] : ["accept", "decline"];
    case "ACCEPTED":
      return ["report"];
    case "REPORTED":
      return duel.reportedByMe ? [] : ["confirm", "contest"];
    default:
      return [];
  }
}

/** One line saying where the duel stands, from the viewer's side. */
export function duelStatusText(duel: Duel): string {
  switch (duel.status) {
    case "PENDING":
      return duel.challengerIsMe ? "Waiting for your target to answer" : "Challenge waiting for your answer";
    case "ACCEPTED":
      return "Accepted. Fight, then report the winner";
    case "REPORTED":
      return duel.reportedByMe
        ? "Waiting for them to confirm your result"
        : `They say ${duel.reportedWinner === "ME" ? "you won" : "they won"}`;
    case "CONTESTED":
      return "Contested. The admin will pick the winner";
    case "COMPLETED":
      return "Finished";
    case "DECLINED":
      return "Declined";
    case "REVOKED":
      return "Revoked";
    case "VOIDED":
      return "Voided because the pairing changed";
  }
}

/** One line saying where an open duel stands, for the admin. */
export function duelAdminStatus(duel: AdminDuel): string {
  switch (duel.status) {
    case "PENDING":
      return "Waiting for the target to answer";
    case "ACCEPTED":
      return "Accepted, no result reported yet";
    case "REPORTED":
      return `${duel.reportedWinner?.displayName ?? "A player"} reported as the winner`;
    case "CONTESTED":
      return "Contested, needs your decision";
    default:
      return "Closed";
  }
}
