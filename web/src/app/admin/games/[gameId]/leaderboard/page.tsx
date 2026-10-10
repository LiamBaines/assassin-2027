import { notFound } from "next/navigation";
import { Leaderboard } from "@/components/leaderboard";
import { getAdminLeaderboard, isApiError } from "@/lib/api";
import { parseRoundParam } from "@/lib/leaderboard";
import { loadAdminGame } from "../load-game";

export default async function AdminLeaderboardPage(props: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const game = await loadAdminGame(props.params);
  const round = parseRoundParam((await props.searchParams).round);

  let data;
  try {
    data = await getAdminLeaderboard(game.id, round);
  } catch (e) {
    if (isApiError(e, "ROUND_NOT_FOUND")) notFound();
    throw e;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Leaderboard</h2>
      <Leaderboard
        data={data}
        basePath={`/admin/games/${encodeURIComponent(game.id)}/leaderboard`}
      />
    </div>
  );
}
