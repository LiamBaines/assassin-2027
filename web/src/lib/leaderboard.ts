/** Parses the `?round=` search param; anything but a positive integer means the game total. */
export function parseRoundParam(
  value: string | string[] | undefined,
): number | undefined {
  if (typeof value !== "string" || !/^[1-9]\d{0,8}$/.test(value)) {
    return undefined;
  }
  return Number(value);
}

/** Link to a leaderboard view: a round, or the game total when roundNo is null. */
export function leaderboardHref(basePath: string, roundNo: number | null): string {
  return roundNo === null ? basePath : `${basePath}?round=${roundNo}`;
}
