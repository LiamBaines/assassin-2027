import { JoinCode } from "@/components/ui";

/** Game name and join code, read-only. */
export function GameTitle({ name, joinCode }: { name: string; joinCode: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <h1 data-testid="game-name" className="font-display text-2xl font-semibold">
        {name}
      </h1>
      <span data-testid="join-code">
        <JoinCode code={joinCode} className="text-sm text-muted" />
      </span>
    </div>
  );
}
