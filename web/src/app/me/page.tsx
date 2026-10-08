import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, PlayerShell } from "@/components/ui";
import { getMe } from "@/lib/api";
import { GAME_STATUS_LABEL, playerStatusView } from "@/lib/player-status";

export const metadata: Metadata = { title: "My games · Assassin 2027" };

export default async function MePage() {
  const me = await getMe();
  if (me.games.length === 0) redirect("/join");

  return (
    <PlayerShell title="My games" isAdmin={me.isAdmin}>
      <ul className="space-y-3">
        {me.games.map(({ game, player }) => {
          const status = playerStatusView(player.status, game.status);
          return (
            <li key={game.id} data-testid="my-game">
              <Link href={`/games/${encodeURIComponent(game.id)}`} className="block">
                <Card className="space-y-2 hover:border-zinc-400">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-lg font-semibold break-words">{game.name}</h2>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {GAME_STATUS_LABEL[game.status]}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600">
                    Playing as{" "}
                    <span className="font-medium text-zinc-900">{player.displayName}</span>
                  </p>
                  <p
                    data-testid="player-status"
                    className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${status.tone}`}
                  >
                    {status.label}
                  </p>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href="/join"
        className="block rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-center font-medium"
      >
        Join another game
      </Link>
      <div className="flex items-center justify-between text-sm text-zinc-600">
        <span>{me.email}</span>
        <SignOutButton />
      </div>
    </PlayerShell>
  );
}
