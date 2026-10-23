import { Trophy } from "lucide-react";
import { EmptyState, StatusChip } from "@/components/ui";
import type { Leaderboard as LeaderboardData } from "@/lib/api-types";
import { rosterStatusView } from "@/lib/player-status";

export const roundLabel = (r: number | null) => (r === null ? "Total" : `Round ${r}`);

/** Ranked table; the caller supplies the round selector. */
export function LeaderboardTable({ data }: { data: LeaderboardData }) {
  if (data.entries.length === 0) {
    return (
      <EmptyState icon={Trophy} title="No scores yet">
        Points appear here once the first kill is confirmed.
      </EmptyState>
    );
  }
  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-surface">
      <table className="tabular w-full text-sm [&_td:nth-child(2)]:whitespace-nowrap">
        <thead className="border-b border-line text-left text-muted">
          <tr>
            <th className="px-2 py-2 sm:px-3 font-medium">#</th>
            <th className="px-2 py-2 sm:px-3 font-medium">Player</th>
            <th className="px-2 py-2 sm:px-3 text-right font-medium">Pts</th>
            <th className="px-2 py-2 sm:px-3 text-right font-medium">BP</th>
            <th className="px-2 py-2 sm:px-3 text-right font-medium">Kills</th>
            <th className="px-2 py-2 sm:px-3 text-right font-medium">Deaths</th>
            <th className="px-2 py-2 sm:px-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.entries.map((e) => {
            const view = rosterStatusView(e.status);
            return (
              <tr key={e.player.id} data-testid="leaderboard-row">
                <td data-testid="lb-rank" className="px-2 py-2 sm:px-3 text-muted">{e.rank}</td>
                <td data-testid="lb-name" className="px-2 py-2 sm:px-3">
                  {e.player.displayName}
                </td>
                <td data-testid="lb-points" className="px-2 py-2 sm:px-3 text-right font-semibold">
                  {e.points}
                </td>
                <td data-testid="lb-bonus" className="px-2 py-2 sm:px-3 text-right">{e.bonusPoints}</td>
                <td data-testid="lb-kills" className="px-2 py-2 sm:px-3 text-right">{e.kills}</td>
                <td data-testid="lb-deaths" className="px-2 py-2 sm:px-3 text-right">{e.deaths}</td>
                <td className="px-2 py-2 sm:px-3">
                  <StatusChip tone={view.tone} icon={view.icon}>
                    {view.label}
                  </StatusChip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
