import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Leaderboard } from "@/components/leaderboard";
import { PlayerShell } from "@/components/ui";
import { getMe, getMyLeaderboard, isApiError } from "@/lib/api";
import { parseRoundParam } from "@/lib/leaderboard";

export const metadata: Metadata = { title: "Leaderboard · Assassin 2027" };

export default async function PlayerLeaderboardPage(props: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const { gameId } = await props.params;
  const round = parseRoundParam((await props.searchParams).round);
  const me = await getMe();
  const mine = me.games.find((g) => g.game.id === gameId);
  if (!mine) notFound();

  let data;
  try {
    data = await getMyLeaderboard(gameId, round);
  } catch (e) {
    if (isApiError(e, "ROUND_NOT_FOUND")) notFound();
    throw e;
  }

  return (
    <PlayerShell title={`${mine.game.name} leaderboard`} isAdmin={me.isAdmin}>
      <Leaderboard data={data} basePath={`/games/${encodeURIComponent(gameId)}/leaderboard`} />
      <Link
        href={`/games/${encodeURIComponent(gameId)}`}
        className="block text-center text-sm text-zinc-600 underline"
      >
        Back to the game
      </Link>
    </PlayerShell>
  );
}
