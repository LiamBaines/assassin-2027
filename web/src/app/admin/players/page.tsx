import {
  ActionForm,
  ConfirmSubmit,
  SubmitButton,
} from "@/components/action-form";
import {
  Alert,
  Card,
  dangerButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { getAdminPlayers, type AdminPlayer } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { setPlayerStatusAction } from "../actions";

const STATUS_STYLE: Record<AdminPlayer["status"], string> = {
  ALIVE: "bg-emerald-100 text-emerald-800",
  DEAD: "bg-red-100 text-red-800",
  REMOVED: "bg-zinc-200 text-zinc-700",
};

export default async function AdminPlayersPage() {
  const players = await getAdminPlayers();
  if (!players) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Players</h1>
        <Alert tone="info">There is no live game. Create one first.</Alert>
      </div>
    );
  }
  const alive = players.filter((p) => p.status === "ALIVE").length;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Players</h1>
        <p className="text-sm text-zinc-600">
          {players.length} registered, {alive} alive
        </p>
      </div>
      <Card className="overflow-x-auto p-0">
        {players.length === 0 ? (
          <p className="p-5 text-sm text-zinc-600">No players have joined yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Current target</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {players.map((p) => (
                <tr key={p.id} data-testid="player-row" className="align-top">
                  <td className="px-4 py-3 font-medium">{p.displayName}</td>
                  <td className="px-4 py-3 text-zinc-600">{p.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.currentTarget?.displayName ?? (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                    {formatDateTime(p.joinedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PlayerAction player={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function PlayerAction({ player }: { player: AdminPlayer }) {
  const restoring = player.status === "REMOVED";
  return (
    <ActionForm
      action={setPlayerStatusAction}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <input type="hidden" name="playerId" value={player.id} />
      <input
        type="hidden"
        name="status"
        value={restoring ? "ALIVE" : "REMOVED"}
      />
      {restoring ? (
        <SubmitButton className={secondaryButtonClass} pendingLabel="Restoring…">
          Restore
        </SubmitButton>
      ) : (
        <ConfirmSubmit
          label="Remove"
          confirmLabel="Remove"
          message={`Remove ${player.displayName}?`}
          className={secondaryButtonClass}
          confirmClassName={dangerButtonClass}
        />
      )}
    </ActionForm>
  );
}
