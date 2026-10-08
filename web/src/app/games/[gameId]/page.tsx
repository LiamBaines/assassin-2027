import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PlayerShell } from "@/components/ui";
import { getMe, getMyTarget } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { playerStatusView } from "@/lib/player-status";

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
  const assignment = finished ? null : await getMyTarget(gameId);

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
      <Link href="/me" className="block text-center text-sm text-zinc-600 underline">
        Back to my games
      </Link>
    </PlayerShell>
  );
}
