/** Join codes are 6–16 letters or numbers, compared case-insensitively. */
export function normalizeJoinCode(raw: unknown): string | null {
  const code = String(raw ?? "")
    .trim()
    .toUpperCase();
  return /^[A-Z0-9]{6,16}$/.test(code) ? code : null;
}

/** The shareable link that opens the join page for a code. */
export function joinLink(siteUrl: string, joinCode: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/join/${encodeURIComponent(joinCode)}`;
}
