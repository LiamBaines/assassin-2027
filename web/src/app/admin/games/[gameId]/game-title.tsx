"use client";

import { InlineEdit } from "@/components/inline-edit";
import { JoinCode } from "@/components/ui";
import { editGameAction } from "../../actions";

type Fields = { name: string; joinCode: string };

async function save(gameId: string, next: Fields): Promise<string | null> {
  const result = await editGameAction(gameId, next);
  return result.error ?? null;
}

/** Game name and join code, each edited in place via a pencil. */
export function GameTitle({ gameId, name, joinCode }: { gameId: string } & Fields) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <InlineEdit
        value={name}
        label="game name"
        maxLength={100}
        onSave={(next) => save(gameId, { name: next, joinCode })}
      >
        <h1 data-testid="game-name" className="font-display text-2xl font-semibold">
          {name}
        </h1>
      </InlineEdit>
      <InlineEdit
        value={joinCode}
        label="join code"
        maxLength={16}
        inputClassName="w-36 font-mono uppercase"
        onSave={(next) => save(gameId, { name, joinCode: next })}
      >
        <span data-testid="join-code">
          <JoinCode code={joinCode} className="text-sm text-muted" />
        </span>
      </InlineEdit>
    </div>
  );
}
