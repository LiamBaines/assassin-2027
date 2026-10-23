import { Award } from "lucide-react";
import { AwardBonus } from "@/components/award-bonus";
import { EmptyState, Panel } from "@/components/ui";
import { getAdminPlayers, listBonuses, listKills } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { awardBonusAction } from "../../../actions";
import { loadAdminGame } from "../load-game";

export default async function AdminBonusesPage(props: {
  params: Promise<{ gameId: string }>;
}) {
  const game = await loadAdminGame(props.params);
  const [bonuses, players, kills] = await Promise.all([
    listBonuses(game.id),
    getAdminPlayers(game.id),
    listKills(game.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">Bonuses</h2>
        {players.length > 0 && game.status !== "FINISHED" && (
          <AwardBonus
            action={awardBonusAction.bind(null, game.id)}
            players={players.map((p) => ({ id: p.id, displayName: p.displayName }))}
            kills={kills.map((k) => ({
              id: k.killId,
              label: `${k.killer.displayName} → ${k.victim.displayName}, ${formatDateTime(k.createdAt)}`,
            }))}
          />
        )}
      </div>
      {bonuses.length === 0 ? (
        <Panel>
          <EmptyState icon={Award} title="No bonuses yet">
            Award or dock points for a player and they will be listed here, on
            the leaderboard and in the game log.
          </EmptyState>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-4 font-medium">Player</th>
                <th className="py-2 pr-4 text-right font-medium">Points</th>
                <th className="py-2 pr-4 font-medium">Reason</th>
                <th className="py-2 pr-4 font-medium">Round</th>
                <th className="py-2 pr-4 font-medium">Kill</th>
                <th className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bonuses.map((b) => (
                <tr key={b.id} data-testid="bonus-row">
                  <td className="py-3 pr-4 font-medium">{b.player.displayName}</td>
                  <td
                    className={`tabular py-3 pr-4 text-right font-medium ${
                      b.points < 0 ? "text-blood" : "text-alive"
                    }`}
                  >
                    {b.points > 0 ? `+${b.points}` : b.points}
                  </td>
                  <td className="py-3 pr-4">{b.reason}</td>
                  <td className="tabular py-3 pr-4 text-muted">{b.roundNo ?? "–"}</td>
                  <td className="py-3 pr-4 text-muted">
                    {b.kill
                      ? `${b.kill.killer.displayName} → ${b.kill.victim.displayName}`
                      : "–"}
                  </td>
                  <td className="py-3 whitespace-nowrap text-muted">
                    {formatDateTime(b.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
