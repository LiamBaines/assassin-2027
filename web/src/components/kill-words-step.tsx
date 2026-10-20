"use client";

import { Dices, Wand2 } from "lucide-react";
import { useState } from "react";
import { Select } from "@/components/select";
import { Alert, IconButton, inputClass, secondaryButtonClass } from "@/components/ui";

type Suggest = (count: number) => Promise<{ words: string[] } | { error: string }>;

/**
 * Words step of the start dialogs: one kill word per player, typed, picked from
 * the game's unused list or drawn at random. Submitted as `word.<playerId>`
 * (parsed by `parseWords`). Words typed for players who drop out are kept but not submitted.
 */
export function KillWordsStep({
  players,
  unusedWords,
  suggest,
}: {
  players: { id: string; displayName: string }[];
  unusedWords: string[];
  suggest: Suggest;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const taken = (except?: string) =>
    new Set(
      Object.entries(values)
        .filter(([id, v]) => id !== except && v.trim() && players.some((p) => p.id === id))
        .map(([, v]) => v.trim().toLowerCase()),
    );
  const blanks = players.filter((p) => !values[p.id]?.trim());

  /** Fresh random words that no row already holds; asks for extra to cover overlaps. */
  const draw = async (n: number): Promise<string[] | null> => {
    const inUse = taken();
    const res = await suggest(Math.min(200, n + inUse.size));
    if ("error" in res) {
      setError(res.error);
      return null;
    }
    const fresh = res.words.filter((w) => !inUse.has(w.toLowerCase())).slice(0, n);
    if (fresh.length < n) {
      setError("There aren't enough unused random words left. Add some on the Kill words tab.");
      return null;
    }
    return fresh;
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const randomFor = (id: string) =>
    run(async () => {
      const words = await draw(1);
      if (words) setValues((v) => ({ ...v, [id]: words[0] }));
    });

  const fillRemaining = () =>
    run(async () => {
      const words = await draw(blanks.length);
      if (!words) return;
      setValues((v) => {
        const next = { ...v };
        blanks.forEach((p, i) => (next[p.id] = words[i]));
        return next;
      });
    });

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Kill words</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Every player needs a unique word. A word given out stays burned.
        </p>
        <button
          type="button"
          onClick={fillRemaining}
          disabled={busy || blanks.length === 0}
          data-testid="fill-random-words"
          className={secondaryButtonClass}
        >
          <Wand2 aria-hidden className="size-4" />
          Fill remaining with random
        </button>
      </div>
      {error && <Alert>{error}</Alert>}
      <ul data-testid="kill-word-assignments" className="max-h-64 space-y-2 overflow-y-auto text-sm">
        {players.map((p) => {
          const others = taken(p.id);
          const options = unusedWords
            .filter((w) => !others.has(w.toLowerCase()))
            .map((w) => ({ value: w, label: w }));
          return (
            <li key={p.id} data-testid="kill-word-assignment" className="flex flex-wrap items-center gap-2">
              <span className="w-32 shrink-0 truncate">{p.displayName}</span>
              <input
                name={`word.${p.id}`}
                value={values[p.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                required
                maxLength={60}
                placeholder="Kill word"
                aria-label={`Kill word for ${p.displayName}`}
                className={`${inputClass} min-w-0 flex-1`}
              />
              {options.length > 0 && (
                <Select
                  options={options}
                  value=""
                  placeholder="From list"
                  aria-label={`Pick a listed word for ${p.displayName}`}
                  onChange={(w) => setValues((v) => ({ ...v, [p.id]: w }))}
                  className="w-32"
                />
              )}
              <IconButton
                icon={Dices}
                label={`Random word for ${p.displayName}`}
                disabled={busy}
                onClick={() => randomFor(p.id)}
              />
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
