import Link from "next/link";
import { Card } from "@/components/ui";
import type { Leaderboard as LeaderboardData } from "@/lib/api-types";
import { leaderboardHref } from "@/lib/leaderboard";
import { rosterStatusView } from "@/lib/player-status";

/** Ranked table with a Total / Round N selector; the selector is plain links, so no client JS. */
export function Leaderboard({
  data,
  basePath,
}: {
  data: LeaderboardData;
  basePath: string;
}) {
  const views = [null, ...data.rounds];
  return (
    <div className="space-y-4">
      <nav aria-label="Leaderboard view" className="flex flex-wrap gap-2 text-sm">
        {views.map((r) => {
          const current = r === data.roundNo;
          return (
            <Link
              key={r ?? "total"}
              href={leaderboardHref(basePath, r)}
              aria-current={current ? "page" : undefined}
              data-testid="leaderboard-view"
              className={`rounded-full px-3 py-1 ${
                current
                  ? "bg-zinc-900 font-medium text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {r === null ? "Total" : `Round ${r}`}
            </Link>
          );
        })}
      </nav>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Player</th>
              <th className="px-3 py-2 text-right font-medium">Pts</th>
              <th className="px-3 py-2 text-right font-medium">Kills</th>
              <th className="px-3 py-2 text-right font-medium">Deaths</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.entries.map((e) => {
              const view = rosterStatusView(e.status);
              return (
                <tr key={e.player.id} data-testid="leaderboard-row">
                  <td data-testid="lb-rank" className="px-3 py-2">{e.rank}</td>
                  <td data-testid="lb-name" className="px-3 py-2 break-words">
                    {e.player.displayName}
                  </td>
                  <td data-testid="lb-points" className="px-3 py-2 text-right font-medium">
                    {e.points}
                  </td>
                  <td data-testid="lb-kills" className="px-3 py-2 text-right">{e.kills}</td>
                  <td data-testid="lb-deaths" className="px-3 py-2 text-right">{e.deaths}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${view.tone}`}>
                      {view.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.entries.length === 0 && (
          <p className="px-3 py-4 text-sm text-zinc-500">No players yet.</p>
        )}
      </Card>
    </div>
  );
}
