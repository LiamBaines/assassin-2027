import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, primaryButtonClass } from "@/components/ui";
import { listAdminGames, requireAdmin } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { createGameAction } from "./actions";
import { GameFields, GameStatusBadge } from "./game-fields";

export default async function AdminGamesPage() {
  await requireAdmin();
  const games = await listAdminGames();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Games</h1>

      <Card className="overflow-x-auto p-0">
        {games.length === 0 ? (
          <p className="p-5 text-sm text-zinc-600">No games yet. Create one below.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Join code</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Players</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {games.map((g) => (
                <tr key={g.id} data-testid="game-row">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/games/${encodeURIComponent(g.id)}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono">{g.joinCode}</td>
                  <td className="px-4 py-3">
                    <GameStatusBadge game={g} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{g.playerCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                    {formatDateTime(g.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Create a game</h2>
          <p className="text-sm text-zinc-600">
            Players sign up with the join code or the game&apos;s join link. A
            code can&apos;t be shared by two games that haven&apos;t finished.
          </p>
        </div>
        <ActionForm action={createGameAction} className="space-y-4">
          <GameFields />
          <SubmitButton className={primaryButtonClass} pendingLabel="Creating…">
            Create game
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
