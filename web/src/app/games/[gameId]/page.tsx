import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Alert,
  Card,
  PlayerShell,
  dangerButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import {
  acceptClaimAction,
  contestClaimAction,
  fileClaimAction,
  withdrawClaimAction,
} from "./actions";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/action-form";
import { getGamePlayers, getMe, getMyKillClaims, getMyTarget } from "@/lib/api";
import { isOpenClaim, outgoingClaimLabel } from "@/lib/claim-status";
import { formatDateTime } from "@/lib/format";
import { playerStatusView, rosterStatusView } from "@/lib/player-status";

export const metadata: Metadata = { title: "Game · Assassin 2027" };

export default async function GamePage(props: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await props.params;
  const me = await getMe();
  const mine = me.games.find((g) => g.game.id === gameId);
  if (!mine) notFound();

  const { game, player } = mine;
  const status = playerStatusView(player.status, game.status);
  // Finishing a game keeps the last assignments, so don't show a stale target.
  const finished = game.status === "FINISHED";
  const active = game.status === "ACTIVE";
  const [assignment, roster, claims] = await Promise.all([
    finished ? null : getMyTarget(gameId),
    game.status === "SETUP" ? null : getGamePlayers(gameId),
    active ? getMyKillClaims(gameId) : null,
  ]);
  const incoming = claims?.incoming ?? null;
  const outgoing = claims?.outgoing ?? null;

  return (
    <PlayerShell title={game.name} isAdmin={me.isAdmin}>
      <Card className="space-y-3">
        <p className="text-sm text-zinc-500">
          Playing as{" "}
          <span data-testid="player-name" className="font-medium text-zinc-900">
            {player.displayName}
          </span>
        </p>
        <p
          data-testid="player-status"
          className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${status.tone}`}
        >
          {status.label}
        </p>
        {status.hint && !finished && (
          <p className="text-sm text-zinc-600">{status.hint}</p>
        )}
        <p className="text-xs text-zinc-500">Joined {formatDateTime(player.joinedAt)}</p>
      </Card>
      {incoming && (
        <Card className="space-y-3">
          <div data-testid="incoming-claim">
            <Alert tone="info">
              {incoming.killerName} says they killed you.
            </Alert>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionForm action={acceptClaimAction.bind(null, gameId, incoming.id)}>
              <SubmitButton className={dangerButtonClass}>
                Yes, I was killed
              </SubmitButton>
            </ActionForm>
            <ActionForm action={contestClaimAction.bind(null, gameId, incoming.id)}>
              <SubmitButton className={secondaryButtonClass}>
                No, contest
              </SubmitButton>
            </ActionForm>
          </div>
        </Card>
      )}
      <Card className="py-10 text-center">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">Your target</h2>
        {finished ? (
          <p data-testid="target-name" className="text-lg text-zinc-600">
            This game has finished
          </p>
        ) : assignment ? (
          <>
            <p data-testid="target-name" className="text-3xl font-semibold break-words">
              {assignment.target.displayName}
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              Assigned {formatDateTime(assignment.assignedAt)}
            </p>
          </>
        ) : (
          <p data-testid="target-name" className="text-lg text-zinc-600">
            No target yet
          </p>
        )}
        {active && assignment && (
          <div className="mt-6 space-y-3">
            {outgoing && (
              <p data-testid="claim-status" className="text-sm text-zinc-700">
                {outgoingClaimLabel(outgoing.status)}
              </p>
            )}
            {outgoing && isOpenClaim(outgoing.status) ? (
              <ActionForm action={withdrawClaimAction.bind(null, gameId, outgoing.id)}>
                <SubmitButton className={secondaryButtonClass}>
                  Withdraw claim
                </SubmitButton>
              </ActionForm>
            ) : (
              <ActionForm action={fileClaimAction.bind(null, gameId)}>
                <ConfirmSubmit
                  label="Register kill"
                  confirmLabel="Yes, I killed them"
                  message={`Did you kill ${assignment.target.displayName}?`}
                  className={primaryButtonClass}
                />
              </ActionForm>
            )}
          </div>
        )}
      </Card>
      {roster && (
        <Card className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500">Players</h2>
          <ul className="divide-y divide-zinc-100">
            {roster.players.map((p, i) => {
              const view = rosterStatusView(p.status);
              return (
                <li
                  key={i}
                  data-testid="roster-row"
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="break-words">{p.displayName}</span>
                  <span
                    data-testid="roster-status"
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${view.tone}`}
                  >
                    {view.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Link href="/me" className="block text-center text-sm text-zinc-600 underline">
        Back to my games
      </Link>
    </PlayerShell>
  );
}
