import { Swords } from "lucide-react";
import Link from "next/link";
import {
  EmptyState,
  JoinCode,
  RelativeTime,
  clickableRowClass,
  rowLinkClass,
} from "@/components/ui";
import { listAdminGames, requireAdmin } from "@/lib/api";
import { GameStatusBadge } from "./game-fields";
import { NewGameDialog } from "./new-game-dialog";

export default async function AdminGamesPage() {
  await requireAdmin();
  const games = await listAdminGames();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold">Games</h1>
        <NewGameDialog />
      </div>

      <div className="overflow-x-auto rounded-panel border border-line bg-surface">
        {games.length === 0 ? (
          <div className="px-5">
            <EmptyState icon={Swords} title="No games yet">
              Choose New game, then share its join code with players.
            </EmptyState>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Join code</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Players</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {games.map((g) => (
                <tr key={g.id} data-testid="game-row" className={clickableRowClass}>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/games/${encodeURIComponent(g.id)}`}
                      className={rowLinkClass}
                    >
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <JoinCode code={g.joinCode} />
                  </td>
                  <td className="px-4 py-3">
                    <GameStatusBadge game={g} />
                  </td>
                  <td className="tabular px-4 py-3 text-right">{g.playerCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    <RelativeTime iso={g.createdAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
