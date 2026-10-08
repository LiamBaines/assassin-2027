const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The API answers 400 for a malformed id, so pages check before calling and 404 instead. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
