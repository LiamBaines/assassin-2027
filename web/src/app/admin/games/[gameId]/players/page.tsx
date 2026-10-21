import { Users, UserMinus, UserPlus } from "lucide-react";
import {
  ActionForm,
  ConfirmSubmit,
  SubmitButton,
} from "@/components/action-form";
import { InlineEdit } from "@/components/inline-edit";
import { RegisterKill } from "@/components/register-kill";
import {
  EmptyState,
  Panel,
  RelativeTime,
  StatusChip,
  dangerButtonClass,
} from "@/components/ui";
import { rosterStatusView } from "@/lib/player-status";
import {
  getAdminKillMethods,
  getAdminPlayers,
  listKillWords,
  type AdminPlayer,
  type KillMethod,
} from "@/lib/api";
import { deathSentenceEnabled } from "@/lib/kill-words";
import { registerKillMessage, removePlayerMessage } from "@/lib/format";
import {
  registerKillAction,
  renamePlayerAction,
  setPlayerStatusAction,
} from "../../../actions";
import { loadAdminGame } from "../load-game";

const ICON = { "aria-hidden": true, className: "size-4" } as const;

export default async function AdminPlayersPage(props: {
  params: Promise<{ gameId: string }>;
}) {
  const game = await loadAdminGame(props.params);
  const [players, allMethods] = await Promise.all([
    getAdminPlayers(game.id),
    getAdminKillMethods(game.id),
  ]);
  const showWords = deathSentenceEnabled(allMethods);
  // Each player's word for the latest round they were given one in.
  const wordOf = new Map<string, { text: string; roundNo: number; used: boolean }>();
  if (showWords) {
    for (const w of await listKillWords(game.id)) {
      if (!w.playerId || w.roundNo === null) continue;
      const seen = wordOf.get(w.playerId);
      if (!seen || w.roundNo > seen.roundNo) {
        wordOf.set(w.playerId, { text: w.text, roundNo: w.roundNo, used: w.state === "USED" });
      }
    }
  }
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
      <Panel flush className="overflow-x-auto">
        {players.length === 0 ? (
          <div className="px-5">
            <EmptyState icon={Users} title="No players yet">
              Share the join link from the Settings tab so players can sign up.
            </EmptyState>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Current target</th>
                {showWords && <th className="px-3 py-2 font-medium">Kill word</th>}
                <th className="px-3 py-2 font-medium">Joined</th>
                {editable && (
                  <th className="px-3 py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {players.map((p) => (
                <tr key={p.id} data-testid="player-row" className="align-top whitespace-nowrap">
                  <td data-testid="admin-player-name" className="px-3 py-2 font-medium">
                    {editable ? (
                      <InlineEdit
                        value={p.displayName}
                        label={`name of ${p.displayName}`}
                        maxLength={32}
                        onSave={renamePlayerAction.bind(null, game.id, p.id)}
                      />
                    ) : (
                      p.displayName
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted">{p.email}</td>
                  <td className="px-3 py-2">
                    <PlayerStatus status={p.status} />
                  </td>
                  <td className="px-3 py-2">
                    {p.currentTarget?.displayName ?? (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  {showWords && (
                    <td data-testid="player-kill-word" className="px-3 py-2">
                      <KillWordCell word={wordOf.get(p.id)} />
                    </td>
                  )}
                  <td className="px-3 py-2 whitespace-nowrap text-muted">
                    <RelativeTime iso={p.joinedAt} />
                  </td>
                  {editable && (
                    <td className="px-3 py-2 text-right">
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

function KillWordCell({
  word,
}: {
  word: { text: string; used: boolean } | undefined;
}) {
  if (!word) return <span className="text-muted">—</span>;
  return word.used ? (
    <span className="text-muted line-through">{word.text} (used)</span>
  ) : (
    word.text
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
        <RegisterKill
          action={registerKillAction.bind(null, gameId)}
          victimId={player.id}
          methods={methods}
          message={registerKillMessage(player, aliveInRing)}
        />
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
