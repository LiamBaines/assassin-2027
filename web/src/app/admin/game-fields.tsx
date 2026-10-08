import type { ReactNode } from "react";
import { inputClass } from "@/components/ui";
import type { AdminGame, GameStatus } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

/** Name and join code inputs, shared by the create and edit forms. */
export function GameFields({ game }: { game?: AdminGame }) {
  return (
    <div className="grid max-w-xl gap-4 sm:grid-cols-2">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          name="name"
          defaultValue={game?.name}
          required
          maxLength={100}
          className={inputClass}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Join code</span>
        <input
          name="joinCode"
          defaultValue={game?.joinCode}
          required
          minLength={6}
          maxLength={16}
          pattern="[A-Za-z0-9]{6,16}"
          title="6–16 letters or numbers"
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} font-mono uppercase`}
        />
      </label>
    </div>
  );
}

const STATUS_STYLE: Record<GameStatus, string> = {
  SETUP: "bg-amber-100 text-amber-900",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  FINISHED: "bg-zinc-200 text-zinc-700",
};

const STATUS_LABEL: Record<GameStatus, string> = {
  SETUP: "Setup",
  ACTIVE: "Active",
  FINISHED: "Finished",
};

/** Game status pill; a finished game shows when it finished. */
export function GameStatusBadge({ game }: { game: AdminGame }) {
  const label =
    game.status === "FINISHED" && game.finishedAt
      ? `Finished ${formatDateTime(game.finishedAt)}`
      : STATUS_LABEL[game.status];
  return (
    <span
      data-testid="game-status"
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[game.status]}`}
    >
      {label}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
