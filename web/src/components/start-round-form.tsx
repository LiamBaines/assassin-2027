"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { KillMethodsEditor } from "@/components/kill-methods-editor";
import type { AdminPlayer, KillMethod } from "@/lib/api-types";

type Action = (
  prev: { error?: string },
  formData: FormData,
) => Promise<{ error?: string }>;

/** "Start new round" button that opens a panel to pick the players, then confirms. */
export function StartRoundForm({
  action,
  expectedRoundNo,
  players,
  killMethods,
}: {
  action: Action;
  expectedRoundNo: number;
  players: Pick<AdminPlayer, "id" | "displayName" | "status">[];
  killMethods: KillMethod[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={secondaryButtonClass}
      >
        Start new round
      </button>
    );
  }

  return (
    <ActionForm
      action={action}
      className="w-full max-w-md space-y-3 rounded-md border border-zinc-200 p-4"
    >
      <input type="hidden" name="expectedRoundNo" value={expectedRoundNo} />
      <p className="text-sm text-zinc-700">
        Tick the players for the new round. Ticked players come back alive;
        unticked players are removed. Current assignments and open claims are
        closed.
      </p>
      <ul data-testid="round-players" className="max-h-64 space-y-1 overflow-y-auto text-sm">
        {players.map((p) => (
          <li key={p.id}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="playerIds"
                value={p.id}
                defaultChecked={p.status !== "REMOVED"}
              />
              <span>{p.displayName}</span>
              <span className="text-zinc-500">({p.status.toLowerCase()})</span>
            </label>
          </li>
        ))}
      </ul>
      <KillMethodsEditor methods={killMethods} />
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Starting…" className={primaryButtonClass}>
          Start round {expectedRoundNo + 1}
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-zinc-600 underline"
        >
          Cancel
        </button>
      </div>
    </ActionForm>
  );
}
