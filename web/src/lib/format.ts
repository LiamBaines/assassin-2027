import type { AdminPlayer } from "@/lib/api-types";

// The game is played in one place, so render times in its local zone rather
// than the server's (UTC on Vercel).
const TIME_ZONE = "Europe/London";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateTime.format(d);
}

/** Removing a player who is in the ring splices them out, so say who inherits what. */
export function removePlayerMessage(player: AdminPlayer): string {
  const question = `Remove ${player.displayName}?`;
  return player.currentTarget
    ? `${question} Their assassin will inherit their target, ${player.currentTarget.displayName}.`
    : question;
}
