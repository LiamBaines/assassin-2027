"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { inputClass } from "@/components/ui";
import type { KillMethod } from "@/lib/api-types";

type Row = { key: number; id?: number; name: string; points: number; enabled: boolean };

/**
 * Editable list of the game's kill methods, submitted with the enclosing form as
 * `method.<i>.id|name|points|enabled` (parsed by `parseKillMethods`). Methods are
 * only ever disabled, never deleted.
 */
export function KillMethodsEditor({ methods }: { methods: KillMethod[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    methods.map((m, i) => ({ ...m, key: i })),
  );
  const [nextKey, setNextKey] = useState(methods.length);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Kill methods</legend>
      <ul data-testid="kill-methods" className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.key}
            data-testid="kill-method-row"
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            {r.id !== undefined && (
              <input type="hidden" name={`method.${i}.id`} value={r.id} />
            )}
            <input
              name={`method.${i}.name`}
              value={r.name}
              onChange={(e) => update(r.key, { name: e.target.value })}
              aria-label="Method name"
              required
              className={`${inputClass} !w-44 !py-1.5 text-sm`}
            />
            <input
              name={`method.${i}.points`}
              type="number"
              min={0}
              step={1}
              value={r.points}
              onChange={(e) => update(r.key, { points: Number(e.target.value) })}
              aria-label="Points"
              required
              className={`${inputClass} !w-20 !py-1.5 text-sm`}
            />
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                name={`method.${i}.enabled`}
                checked={r.enabled}
                onChange={(e) => update(r.key, { enabled: e.target.checked })}
              />
              Enabled
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          setRows((rs) => [
            ...rs,
            { key: nextKey, name: "", points: 10, enabled: true },
          ]);
          setNextKey(nextKey + 1);
        }}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-bone"
      >
        <Plus aria-hidden className="size-4" />
        Add method
      </button>
    </fieldset>
  );
}
