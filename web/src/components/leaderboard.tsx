import Link from "next/link";
import { Trophy } from "lucide-react";
import { EmptyState, StatusChip } from "@/components/ui";
import type { Leaderboard as LeaderboardData } from "@/lib/api-types";
import { leaderboardHref } from "@/lib/leaderboard";
import { rosterStatusView } from "@/lib/player-status";

export const viewTabClass = (current: boolean) =>
  `rounded-control border px-3 py-1.5 text-sm ${
    current
      ? "border-bone bg-bone font-medium text-ink"
      : "border-line text-muted hover:border-muted hover:text-bone"
  }`;

export const roundLabel = (r: number | null) => (r === null ? "Total" : `Round ${r}`);

/** Ranked table; the caller supplies the Total / Round N selector. */
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
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Player</th>
            <th className="px-3 py-2 text-right font-medium">Pts</th>
            <th className="px-3 py-2 text-right font-medium">Kills</th>
            <th className="px-3 py-2 text-right font-medium">Deaths</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.entries.map((e) => {
            const view = rosterStatusView(e.status);
            return (
              <tr key={e.player.id} data-testid="leaderboard-row">
                <td data-testid="lb-rank" className="px-3 py-2 text-muted">{e.rank}</td>
                <td data-testid="lb-name" className="px-3 py-2">
                  {e.player.displayName}
                </td>
                <td data-testid="lb-points" className="px-3 py-2 text-right font-semibold">
                  {e.points}
                </td>
                <td data-testid="lb-kills" className="px-3 py-2 text-right">{e.kills}</td>
                <td data-testid="lb-deaths" className="px-3 py-2 text-right">{e.deaths}</td>
                <td className="px-3 py-2">
                  <StatusChip tone={view.tone} icon={view.icon}>
                    <span className="sr-only sm:not-sr-only">{view.label}</span>
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

/** Link-based selector (admin pages); the player view switches client-side instead. */
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
      <nav aria-label="Leaderboard view" className="flex flex-wrap gap-2">
        {views.map((r) => (
          <Link
            key={r ?? "total"}
            href={leaderboardHref(basePath, r)}
            aria-current={r === data.roundNo ? "page" : undefined}
            data-testid="leaderboard-view"
            className={viewTabClass(r === data.roundNo)}
          >
            {roundLabel(r)}
          </Link>
        ))}
      </nav>
      <LeaderboardTable data={data} />
    </div>
  );
}
