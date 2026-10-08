/**
 * Returns `next` only if it is a same-origin relative path, otherwise "/".
 * Prevents open redirects through the `next` query parameter.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  // "//host" and "/\host" are treated as protocol-relative by browsers.
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  // Reject control characters, which some browsers strip before parsing.
  if (/[\u0000-\u001F\u007F]/.test(next)) return "/";
  try {
    const base = "http://localhost";
    const url = new URL(next, base);
    if (url.origin !== base) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
