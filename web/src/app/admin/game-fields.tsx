import { Clock, Flag, Play, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { StatusChip, inputClass, type StatusTone } from "@/components/ui";
import type { AdminGame, GameStatus } from "@/lib/api";

/** Name and join code inputs, shared by the create and edit forms. */
export function GameFields({ game }: { game?: AdminGame }) {
  return (
    <div className="grid max-w-xl gap-4">
      <label className="block space-y-1.5">
        <span className="block text-sm font-medium">Name</span>
        <input
          name="name"
          defaultValue={game?.name}
          required
          maxLength={100}
          className={inputClass}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="block text-sm font-medium">Join code</span>
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
          className={`${inputClass} font-mono text-base tracking-wide uppercase`}
        />
      </label>
    </div>
  );
}

const STATUS_VIEW: Record<GameStatus, { label: string; tone: StatusTone; icon: LucideIcon }> = {
  SETUP: { label: "Setup", tone: "warn", icon: Clock },
  ACTIVE: { label: "Active", tone: "alive", icon: Play },
  FINISHED: { label: "Finished", tone: "neutral", icon: Flag },
};

/** Game status chip. */
export function GameStatusBadge({ game }: { game: AdminGame }) {
  const view = STATUS_VIEW[game.status];
  return (
    <StatusChip data-testid="game-status" tone={view.tone} icon={view.icon}>
      {view.label}
    </StatusChip>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
