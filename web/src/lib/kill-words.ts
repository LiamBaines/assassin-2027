import { isUuid } from "@/lib/uuid";

/**
 * Reads the words step's fields (`word.<playerId>`). Returns undefined when
 * the form has no words step, and null when a key isn't a player id. Blank
 * words are left out so the API reports the player as missing a word.
 */
export function parseWords(
  formData: FormData,
  only?: string[],
): Record<string, string> | undefined | null {
  const words: Record<string, string> = {};
  let found = false;
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("word.")) continue;
    found = true;
    const playerId = key.slice("word.".length);
    if (!isUuid(playerId)) return null;
    if (only && !only.includes(playerId)) continue;
    const text = String(value).trim();
    if (text) words[playerId] = text;
  }
  return found ? words : undefined;
}

/** Words typed one per line; blank lines are dropped. */
export const splitWordLines = (raw: string) =>
  raw
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter(Boolean);

/** Kill words only apply while an enabled method is named "Death Sentence". */
export const deathSentenceEnabled = (methods: { name: string; enabled: boolean }[]) =>
  methods.some((m) => m.enabled && m.name.trim().toLowerCase() === "death sentence");
