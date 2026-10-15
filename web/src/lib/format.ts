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

/** Registering a kill passes the victim's target to their assassin; with two left it ends the game. */
export function registerKillMessage(player: AdminPlayer, aliveInRing: number): string {
  const question = `Register ${player.displayName} as killed?`;
  if (aliveInRing <= 2) return `${question} Only two players are left, so this ends the game.`;
  return player.currentTarget
    ? `${question} Their assassin will inherit their target, ${player.currentTarget.displayName}.`
    : question;
}

/** Removing a player who is in the ring splices them out, so say who inherits what. */
export function removePlayerMessage(player: AdminPlayer): string {
  const question = `Remove ${player.displayName}?`;
  return player.currentTarget
    ? `${question} Their assassin will inherit their target, ${player.currentTarget.displayName}.`
    : question;
}

/** Short relative age such as "5m ago" or "2d ago". Pair with the full date-time as a tooltip. */
export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const units: [string, number][] = [
    ["y", 365 * 86400],
    ["mo", 30 * 86400],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
  ];
  for (const [unit, size] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${unit} ago`;
  }
  return "just now";
}
