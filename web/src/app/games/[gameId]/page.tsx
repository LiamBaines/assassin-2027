import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PlayerShell } from "@/components/ui";
import { getGamePlayers, getMe, getMyTarget } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { playerStatusView, rosterStatusView } from "@/lib/player-status";

export const metadata: Metadata = { title: "Game · Assassin 2027" };

export default async function GamePage(props: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await props.params;
  const me = await getMe();
  const mine = me.games.find((g) => g.game.id === gameId);
  if (!mine) notFound();

  const { game, player } = mine;
  const status = playerStatusView(player.status, game.status);
  // Finishing a game keeps the last assignments, so don't show a stale target.
  const finished = game.status === "FINISHED";
  const [assignment, roster] = await Promise.all([
    finished ? null : getMyTarget(gameId),
    game.status === "SETUP" ? null : getGamePlayers(gameId),
  ]);

  return (
    <PlayerShell title={game.name} isAdmin={me.isAdmin}>
      <Card className="space-y-3">
        <p className="text-sm text-zinc-500">
          Playing as{" "}
          <span data-testid="player-name" className="font-medium text-zinc-900">
            {player.displayName}
          </span>
        </p>
        <p
          data-testid="player-status"
          className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${status.tone}`}
        >
          {status.label}
        </p>
        {status.hint && !finished && (
          <p className="text-sm text-zinc-600">{status.hint}</p>
        )}
        <p className="text-xs text-zinc-500">Joined {formatDateTime(player.joinedAt)}</p>
      </Card>
      <Card className="py-10 text-center">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">Your target</h2>
        {finished ? (
          <p data-testid="target-name" className="text-lg text-zinc-600">
            This game has finished
          </p>
        ) : assignment ? (
          <>
            <p data-testid="target-name" className="text-3xl font-semibold break-words">
              {assignment.target.displayName}
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              Assigned {formatDateTime(assignment.assignedAt)}
            </p>
          </>
        ) : (
          <p data-testid="target-name" className="text-lg text-zinc-600">
            No target yet
          </p>
        )}
      </Card>
      {roster && (
        <Card className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500">Players</h2>
          <ul className="divide-y divide-zinc-100">
            {roster.players.map((p, i) => {
              const view = rosterStatusView(p.status);
              return (
                <li
                  key={i}
                  data-testid="roster-row"
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="break-words">{p.displayName}</span>
                  <span
                    data-testid="roster-status"
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${view.tone}`}
                  >
                    {view.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Link href="/me" className="block text-center text-sm text-zinc-600 underline">
        Back to my games
      </Link>
    </PlayerShell>
  );
}
