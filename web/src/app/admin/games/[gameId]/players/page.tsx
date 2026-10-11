import { Users, Check, Crosshair, Save, UserMinus, UserPlus, X } from "lucide-react";
import {
  ActionForm,
  ConfirmSubmit,
  SubmitButton,
} from "@/components/action-form";
import { KillMethodSelect } from "@/components/kill-method-select";
import {
  EmptyState,
  Panel,
  StatusChip,
  dangerButtonClass,
} from "@/components/ui";
import { rosterStatusView } from "@/lib/player-status";
import {
  getAdminKillMethods,
  getAdminPlayers,
  listKills,
  listOpenKillClaims,
  type AdminPlayer,
  type KillMethod,
} from "@/lib/api";
import {
  formatDateTime,
  registerKillMessage,
  removePlayerMessage,
} from "@/lib/format";
import {
  changeKillMethodAction,
  confirmClaimAction,
  dismissClaimAction,
  registerKillAction,
  setPlayerStatusAction,
} from "../../../actions";
import { loadAdminGame } from "../load-game";

const ICON = { "aria-hidden": true, className: "size-4" } as const;

export default async function AdminPlayersPage(props: {
  params: Promise<{ gameId: string }>;
}) {
  const game = await loadAdminGame(props.params);
  const [players, claims, allMethods, kills] = await Promise.all([
    getAdminPlayers(game.id),
    listOpenKillClaims(game.id),
    getAdminKillMethods(game.id),
    listKills(game.id),
  ]);
  const enabledMethods = allMethods.filter((m) => m.enabled);
  const editable = game.status !== "FINISHED";
  const alive = players.filter((p) => p.status === "ALIVE").length;
  const aliveInRing = players.filter(
    (p) => p.status === "ALIVE" && p.currentTarget,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold">Players</h2>
        <p className="text-sm text-muted">
          {players.length} registered, {alive} alive
        </p>
      </div>
      {claims.length > 0 && (
        <Panel className="space-y-3">
          <h3 className="font-semibold" data-testid="kill-claims-heading">
            Kill claims
          </h3>
          <ul className="divide-y divide-line">
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
                    <span className="font-medium">{c.victimName}</span> with{" "}
                    <span data-testid="claim-method">{c.killMethod.name}</span>
                  </p>
                  <p className="text-muted">
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
                      icon={<Check {...ICON} />}
                      iconOnly
                      message={`Confirm that ${c.killerName} killed ${c.victimName}? This removes ${c.victimName} from the ring.`}
                      className="!text-alive"
                      confirmClassName={dangerButtonClass}
                    />
                  </ActionForm>
                  <ActionForm
                    action={dismissClaimAction.bind(null, game.id, c.id)}
                    className="flex items-center gap-2"
                  >
                    <SubmitButton icon={<X {...ICON} />} iconOnly pendingLabel="Dismissing…">
                      Dismiss
                    </SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {kills.length > 0 && (
        <Panel className="space-y-3">
          <h3 className="font-semibold">Kills</h3>
          <ul className="divide-y divide-line">
            {kills.map((k) => (
              <li
                key={k.killId}
                data-testid="kill-row"
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <p>
                  <span className="font-medium">{k.killer.displayName}</span>{" "}
                  killed{" "}
                  <span className="font-medium">{k.victim.displayName}</span>{" "}
                  with <span data-testid="kill-method">{k.killMethod.name}</span>{" "}
                  <span className="text-muted">
                    · {formatDateTime(k.createdAt)}
                  </span>
                </p>
                {editable && (
                  <ActionForm
                    action={changeKillMethodAction.bind(null, game.id, k.killId)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <KillMethodSelect
                      methods={enabledMethods}
                      defaultValue={k.killMethod.id}
                    />
                    <SubmitButton icon={<Save {...ICON} />} iconOnly pendingLabel="Saving…">
                      Change method
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel flush className="overflow-x-auto">
        {players.length === 0 ? (
          <div className="px-5">
            <EmptyState icon={Users} title="No players yet">
              Share the join link from the Details tab so players can sign up.
            </EmptyState>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
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
            <tbody className="divide-y divide-line">
              {players.map((p) => (
                <tr key={p.id} data-testid="player-row" className="align-top whitespace-nowrap">
                  <td className="px-4 py-3 font-medium">{p.displayName}</td>
                  <td className="px-4 py-3 text-muted">{p.email}</td>
                  <td className="px-4 py-3">
                    <PlayerStatus status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    {p.currentTarget?.displayName ?? (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {formatDateTime(p.joinedAt)}
                  </td>
                  {editable && (
                    <td className="px-4 py-3 text-right">
                      <PlayerAction
                        gameId={game.id}
                        player={p}
                        active={game.status === "ACTIVE"}
                        aliveInRing={aliveInRing}
                        methods={enabledMethods}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function PlayerStatus({ status }: { status: AdminPlayer["status"] }) {
  const view = rosterStatusView(status);
  return (
    <StatusChip tone={view.tone} icon={view.icon}>
      {view.label}
    </StatusChip>
  );
}

function PlayerAction({
  gameId,
  player,
  active,
  aliveInRing,
  methods,
}: {
  gameId: string;
  player: AdminPlayer;
  active: boolean;
  aliveInRing: number;
  methods: KillMethod[];
}) {
  const restoring = player.status === "REMOVED";
  // Only a player with a target is in the ring, and only a ring player can be killed.
  const killable =
    active && player.status === "ALIVE" && player.currentTarget !== null;
  return (
    <div className="flex items-center justify-end gap-2">
      {killable && (
        <ActionForm
          action={registerKillAction.bind(null, gameId)}
          className="flex flex-wrap items-center justify-end gap-2"
        >
          <input type="hidden" name="victimId" value={player.id} />
          <KillMethodSelect methods={methods} />
          <ConfirmSubmit
            label="Register kill"
            confirmLabel="Register kill"
            icon={<Crosshair {...ICON} />}
            iconOnly
            message={registerKillMessage(player, aliveInRing)}
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
          <SubmitButton icon={<UserPlus {...ICON} />} iconOnly pendingLabel="Restoring…">
            Restore
          </SubmitButton>
        ) : (
          <ConfirmSubmit
            label="Remove"
            confirmLabel="Remove"
            icon={<UserMinus {...ICON} />}
            iconOnly
            message={removePlayerMessage(player)}
            confirmClassName={dangerButtonClass}
          />
        )}
      </ActionForm>
    </div>
  );
}
