
export const LAST_AREA_COOKIE = "last-area";
export const LAST_GAME_COOKIE = "last-game";

export type Area = "admin" | "player";

export function parseArea(value: string | undefined): Area | null {
  return value === "admin" || value === "player" ? value : null;
}

/** Where `/` should send someone, given the cookies and what they can still access. */
export function resolveHome(opts: {
  isAdmin: boolean;
  gameIds: string[];
  lastArea?: string;
  lastGame?: string;
}): string {
  if (opts.isAdmin && parseArea(opts.lastArea) === "admin") return "/admin";
  const { lastGame } = opts;
  if (lastGame && opts.gameIds.includes(lastGame)) {
    return `/${encodeURIComponent(lastGame)}`;
  }
  return opts.gameIds.length > 0 ? "/me" : "/join";
}
