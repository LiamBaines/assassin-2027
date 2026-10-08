import { ActionForm, ConfirmSubmit } from "@/components/action-form";
import { Alert, Card, primaryButtonClass } from "@/components/ui";
import { getCurrentRing, getRingHistory, type RoundReason } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { shuffleRingAction } from "../../../actions";
import { loadAdminGame } from "../load-game";

const REASON_LABEL: Record<RoundReason, string> = {
  INITIAL: "Initial",
  SHAKEUP: "Shakeup",
};

export default async function AdminRingsPage(props: {
  params: Promise<{ gameId: string }>;
}) {
  const game = await loadAdminGame(props.params);
  const [ring, history] = await Promise.all([
    getCurrentRing(game.id),
    getRingHistory(game.id),
  ]);

  const canShuffle = game.status !== "FINISHED";
  const isShakeup = ring !== null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Rings</h2>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">
              {ring
                ? `Current ring — round ${ring.roundNo} (${REASON_LABEL[ring.reason]})`
                : "No ring yet"}
            </h3>
            {canShuffle && (
              <p className="text-sm text-zinc-600">
                {isShakeup
                  ? "A shakeup puts every alive player into a new ring. Current assignments are replaced and kept in history."
                  : "Generating the ring gives every alive player a target and starts the game."}
              </p>
            )}
          </div>
          {canShuffle && (
            <ActionForm
              action={shuffleRingAction.bind(null, game.id)}
              className="flex max-w-md flex-wrap items-center justify-end gap-3"
            >
              <input
                type="hidden"
                name="expectedCurrentRoundNo"
                value={ring?.roundNo ?? ""}
              />
              <ConfirmSubmit
                label={isShakeup ? "Shake up" : "Generate ring"}
                confirmLabel={isShakeup ? "Yes, shake up" : "Yes, generate"}
                message={
                  isShakeup
                    ? "Replace every current target?"
                    : "Assign targets to all alive players?"
                }
                className={primaryButtonClass}
              />
            </ActionForm>
          )}
        </div>

        {!canShuffle && <Alert tone="info">The game has finished.</Alert>}

        {ring && (
          <ol data-testid="current-ring" className="divide-y divide-zinc-100 text-sm">
            {ring.ring.map(({ assassin, target }, i) => (
              <li
                key={assassin.id}
                data-testid="ring-pair"
                className="grid grid-cols-[2.5rem_1fr_auto_1fr] items-center gap-3 py-2"
              >
                <span className="text-zinc-400 tabular-nums">{i + 1}</span>
                <span className="font-medium" data-role="assassin">
                  {assassin.displayName}
                </span>
                <span aria-label="targets" className="text-zinc-400">
                  →
                </span>
                <span data-role="target">{target.displayName}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <h3 className="px-5 pt-5 text-lg font-semibold">Round history</h3>
        {history.length === 0 ? (
          <p className="p-5 text-sm text-zinc-600">No rounds yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="border-y border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-medium">Round</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Players</th>
                <th className="px-5 py-3 font-medium">Run by</th>
                <th className="px-5 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {history.map((r) => (
                <tr key={r.roundId} data-testid="round-row">
                  <td className="px-5 py-3 tabular-nums">{r.roundNo}</td>
                  <td className="px-5 py-3">{REASON_LABEL[r.reason]}</td>
                  <td className="px-5 py-3 tabular-nums">{r.playerCount}</td>
                  <td className="px-5 py-3 text-zinc-600">{r.createdBy}</td>
                  <td className="px-5 py-3 text-zinc-600">
                    {formatDateTime(r.createdAt)}
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
