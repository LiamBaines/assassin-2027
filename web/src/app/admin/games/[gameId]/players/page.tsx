import {
  ActionForm,
  ConfirmSubmit,
  SubmitButton,
} from "@/components/action-form";
import { Card, dangerButtonClass, secondaryButtonClass } from "@/components/ui";
import {
  getAdminPlayers,
  listOpenKillClaims,
  type AdminPlayer,
} from "@/lib/api";
import {
  formatDateTime,
  registerKillMessage,
  removePlayerMessage,
} from "@/lib/format";
import {
  confirmClaimAction,
  dismissClaimAction,
  registerKillAction,
  setPlayerStatusAction,
} from "../../../actions";
import { loadAdminGame } from "../load-game";

const STATUS_STYLE: Record<AdminPlayer["status"], string> = {
  ALIVE: "bg-emerald-100 text-emerald-800",
  DEAD: "bg-red-100 text-red-800",
  REMOVED: "bg-zinc-200 text-zinc-700",
};

export default async function AdminPlayersPage(props: {
  params: Promise<{ gameId: string }>;
}) {
  const game = await loadAdminGame(props.params);
  const [players, claims] = await Promise.all([
    getAdminPlayers(game.id),
    listOpenKillClaims(game.id),
  ]);
  const editable = game.status !== "FINISHED";
  const alive = players.filter((p) => p.status === "ALIVE").length;
  const aliveInRing = players.filter(
    (p) => p.status === "ALIVE" && p.currentTarget,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Players</h2>
        <p className="text-sm text-zinc-600">
          {players.length} registered, {alive} alive
        </p>
      </div>
      {claims.length > 0 && (
        <Card className="space-y-3">
          <h3 className="font-semibold" data-testid="kill-claims-heading">
            Kill claims
          </h3>
          <ul className="divide-y divide-zinc-100">
            {claims.map((c) => (
              <li
                key={c.id}
                data-testid="kill-claim"
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p>
                    <span className="font-medium">{c.killerName}</span> says
                    they killed{" "}
                    <span className="font-medium">{c.victimName}</span>
                  </p>
                  <p className="text-zinc-600">
                    {c.status === "CONTESTED"
                      ? "Contested by the victim"
                      : "Waiting for the victim"}{" "}
                    · filed {formatDateTime(c.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ActionForm
                    action={confirmClaimAction.bind(null, game.id, c.id)}
                    className="flex items-center gap-2"
                  >
                    <ConfirmSubmit
                      label="Confirm kill"
                      confirmLabel="Confirm kill"
                      message={`Confirm that ${c.killerName} killed ${c.victimName}? This removes ${c.victimName} from the ring.`}
                      className={secondaryButtonClass}
                      confirmClassName={dangerButtonClass}
                    />
                  </ActionForm>
                  <ActionForm
                    action={dismissClaimAction.bind(null, game.id, c.id)}
                    className="flex items-center gap-2"
                  >
                    <SubmitButton
                      className={secondaryButtonClass}
                      pendingLabel="Dismissing…"
                    >
                      Dismiss
                    </SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
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
                {editable && (
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
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
                  {editable && (
                    <td className="px-4 py-3 text-right">
                      <PlayerAction
                        gameId={game.id}
                        player={p}
                        active={game.status === "ACTIVE"}
                        aliveInRing={aliveInRing}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function PlayerAction({
  gameId,
  player,
  active,
  aliveInRing,
}: {
  gameId: string;
  player: AdminPlayer;
  active: boolean;
  aliveInRing: number;
}) {
  const restoring = player.status === "REMOVED";
  // Only a player with a target is in the ring, and only a ring player can be killed.
  const killable =
    active && player.status === "ALIVE" && player.currentTarget !== null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {killable && (
        <ActionForm
          action={registerKillAction.bind(null, gameId)}
          className="flex flex-wrap items-center justify-end gap-2"
        >
          <input type="hidden" name="victimId" value={player.id} />
          <ConfirmSubmit
            label="Register kill"
            confirmLabel="Register kill"
            message={registerKillMessage(player, aliveInRing)}
            className={secondaryButtonClass}
            confirmClassName={dangerButtonClass}
          />
        </ActionForm>
      )}
      <ActionForm
        action={setPlayerStatusAction.bind(null, gameId)}
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
            message={removePlayerMessage(player)}
            className={secondaryButtonClass}
            confirmClassName={dangerButtonClass}
          />
        )}
      </ActionForm>
    </div>
  );
}
