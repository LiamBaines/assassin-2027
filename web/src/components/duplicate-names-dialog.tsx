"use client";

import { useState } from "react";
import { Dialog, DialogActions } from "@/components/overlay";
import { InlineEdit } from "@/components/inline-edit";
import type { PlayerRef } from "@/lib/api-types";

const key = (name: string) => name.toLowerCase();

/**
 * Lists the players whose identical names blocked a round or ring, with an inline rename for each. A rename only
 * changes the name in this game. Once no two names match, the admin closes it and runs the action again.
 */
export function DuplicateNamesDialog({
  open,
  onClose,
  players,
  rename,
}: {
  open: boolean;
  onClose: () => void;
  players: PlayerRef[];
  rename: (playerId: string, displayName: string) => Promise<string | null>;
}) {
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(players.map((p) => [p.id, p.displayName])),
  );
  const nameOf = (p: PlayerRef) => names[p.id] ?? p.displayName;
  const counts = new Map<string, number>();
  for (const p of players) counts.set(key(nameOf(p)), (counts.get(key(nameOf(p))) ?? 0) + 1);
  const resolved = [...counts.values()].every((n) => n === 1);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Some players share a name"
      description="Give one or both a different name, for example with a second initial. It only changes the name shown in this game, and players won't see that it differs."
    >
      <ul data-testid="duplicate-names" className="divide-y divide-line text-sm">
        {players.map((p) => (
          <li key={p.id} className="py-2">
            <InlineEdit
              value={nameOf(p)}
              label={`name of ${nameOf(p)}`}
              maxLength={32}
              onSave={async (next) => {
                const error = await rename(p.id, next);
                if (!error) setNames((prev) => ({ ...prev, [p.id]: next }));
                return error;
              }}
            >
              <span className="font-medium">{nameOf(p)}</span>
            </InlineEdit>
          </li>
        ))}
      </ul>
      <p role="status" className="text-sm text-muted">
        {resolved
          ? "The names are different now. Close this and start again."
          : "Rename until every name is different."}
      </p>
      <DialogActions onCancel={onClose} cancelLabel="Close" />
    </Dialog>
  );
}
