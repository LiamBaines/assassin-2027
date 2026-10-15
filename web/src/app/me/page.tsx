import type { Metadata } from "next";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LastViewRecorder } from "@/components/last-view-recorder";
import { SignOutButton } from "@/components/sign-out-button";
import { PlayerShell, StatusChip, secondaryButtonClass } from "@/components/ui";
import { getMe } from "@/lib/api";
import { GAME_STATUS_LABEL, playerStatusView } from "@/lib/player-status";

export const metadata: Metadata = { title: "My games · Assassin 2027" };

export default async function MePage() {
  const me = await getMe();
  if (me.games.length === 0) redirect("/join");

  return (
    <PlayerShell title="My games" isAdmin={me.isAdmin}>
      <LastViewRecorder area="player" />
      <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
        {me.games.map(({ game, player }) => {
          const status = playerStatusView(player.status, game.status);
          return (
            <li key={game.id} data-testid="my-game">
              <Link
                href={`/${encodeURIComponent(game.id)}`}
                className="flex items-center gap-3 p-4 hover:bg-raised"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="font-display text-xl font-semibold break-words">
                    {game.name}
                  </h2>
                  <p className="text-sm text-muted">
                    Playing as {player.displayName} · {GAME_STATUS_LABEL[game.status]}
                  </p>
                  <StatusChip data-testid="player-status" tone={status.tone} icon={status.icon}>
                    {status.label}
                  </StatusChip>
                </div>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/join" className={`${secondaryButtonClass} w-full`}>
        <Plus aria-hidden className="size-4" />
        Join another game
      </Link>
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{me.email}</span>
        <SignOutButton />
      </div>
    </PlayerShell>
  );
}
