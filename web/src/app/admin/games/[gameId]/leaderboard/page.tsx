import { notFound } from "next/navigation";
import { LeaderboardTable } from "@/components/leaderboard";
import { RoundActions } from "@/components/round-actions";
import { AdminRoundSelect } from "@/components/round-select";
import {
  getAdminKillMethods,
  getAdminLeaderboard,
  getAdminPlayers,
  getAdminRounds,
  getCurrentRing,
  isApiError,
} from "@/lib/api";
import { parseRoundParam } from "@/lib/leaderboard";
import { shuffleRingAction, startRoundAction } from "../../../actions";
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
  const [currentRing, rounds, players, killMethods] = await Promise.all([
    getCurrentRing(game.id),
    getAdminRounds(game.id),
    getAdminPlayers(game.id),
    getAdminKillMethods(game.id),
  ]);

  const latestRound = rounds[0] ?? null;
  // An ended round has no live ring, whatever the API still returns.
  const ring = latestRound?.endedAt != null ? null : currentRing;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">Leaderboard</h2>
        <div className="flex items-center gap-2">
          <AdminRoundSelect
            rounds={data.rounds}
            value={data.roundNo}
            basePath={`/admin/games/${encodeURIComponent(game.id)}/leaderboard`}
          />
          <RoundActions
            key={`${latestRound?.roundNo}-${latestRound?.endedAt}-${ring?.roundNo}`}
            gameActive={game.status !== "FINISHED"}
            latestRound={latestRound}
            ring={ring}
            players={players}
            killMethods={killMethods}
            shuffleAction={shuffleRingAction.bind(null, game.id)}
            startRoundAction={startRoundAction.bind(null, game.id)}
          />
        </div>
      </div>
      <LeaderboardTable data={data} />
    </div>
  );
}
