import { Plus, Swords } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { EmptyState, Panel, primaryButtonClass } from "@/components/ui";
import { listAdminGames, requireAdmin } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { createGameAction } from "./actions";
import { GameFields, GameStatusBadge } from "./game-fields";

export default async function AdminGamesPage() {
  await requireAdmin();
  const games = await listAdminGames();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Games</h1>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="overflow-x-auto rounded-panel border border-line bg-surface">
          {games.length === 0 ? (
            <div className="px-5">
              <EmptyState icon={Swords} title="No games yet">
                Create your first game with the form, then share its join code with players.
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
                  <tr key={g.id} data-testid="game-row" className="hover:bg-raised">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/admin/games/${encodeURIComponent(g.id)}`}
                        className="hover:underline"
                      >
                        {g.name}
                      </Link>
                    </td>
                    <td className="font-display px-4 py-3 text-base tracking-widest">
                      {g.joinCode}
                    </td>
                    <td className="px-4 py-3">
                      <GameStatusBadge game={g} />
                    </td>
                    <td className="tabular px-4 py-3 text-right">{g.playerCount}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDateTime(g.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Panel className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Create a game</h2>
            <p className="mt-1 text-sm text-muted">
              Players sign up with the join code or the game&apos;s join link. A code can&apos;t
              be shared by two games that haven&apos;t finished.
            </p>
          </div>
          <ActionForm action={createGameAction} className="space-y-4">
            <GameFields />
            <SubmitButton className={primaryButtonClass} pendingLabel="Creating…">
              <Plus aria-hidden className="size-4" />
              Create game
            </SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
