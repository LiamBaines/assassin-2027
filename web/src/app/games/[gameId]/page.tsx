import { History, ShieldCheck, Swords, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/action-form";
import { KillMethodSelect } from "@/components/kill-method-select";
import { PlayerLeaderboard } from "@/components/player-leaderboard";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Alert,
  EmptyState,
  StatusChip,
  dangerButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import {
  getGamePlayers,
  getMe,
  getMyKillClaims,
  getMyKillMethods,
  getMyLeaderboard,
  getMyRounds,
  getMyTarget,
} from "@/lib/api";
import type { Leaderboard } from "@/lib/api-types";
import { isOpenClaim, outgoingClaimLabel } from "@/lib/claim-status";
import { formatDateTime } from "@/lib/format";
import { parseRoundParam } from "@/lib/leaderboard";
import { playerStatusView, rosterStatusView } from "@/lib/player-status";
import { roundOutcomeLabel } from "@/lib/round-outcome";
import {
  acceptClaimAction,
  contestClaimAction,
  fileClaimAction,
  withdrawClaimAction,
} from "./actions";
import { GameShell, type GameView } from "./game-shell";

export const metadata: Metadata = { title: "Game · Assassin 2027" };

const VIEWS: GameView[] = ["target", "players", "leaderboard", "rounds"];

export default async function GamePage(props: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ view?: string | string[]; round?: string | string[] }>;
}) {
  const { gameId } = await props.params;
  const search = await props.searchParams;
  const me = await getMe();
  const mine = me.games.find((g) => g.game.id === gameId);
  if (!mine) notFound();

  const { game, player } = mine;
  const status = playerStatusView(player.status, game.status);
  // Finishing a game keeps the last assignments, so don't show a stale target.
  const finished = game.status === "FINISHED";
  const active = game.status === "ACTIVE";
  const started = game.status !== "SETUP";
  const [assignment, roster, claims, pastRounds, killMethods, total] = await Promise.all([
    finished ? null : getMyTarget(gameId),
    started ? getGamePlayers(gameId) : null,
    active ? getMyKillClaims(gameId) : null,
    game.currentRoundNo === null ? [] : getMyRounds(gameId),
    active ? getMyKillMethods(gameId) : [],
    started ? getMyLeaderboard(gameId) : null,
  ]);
  const perRound: Record<number, Leaderboard> = {};
  if (total) {
    const boards = await Promise.all(total.rounds.map((r) => getMyLeaderboard(gameId, r)));
    total.rounds.forEach((r, i) => (perRound[r] = boards[i]));
  }
  const incoming = claims?.incoming ?? null;
  const outgoing = claims?.outgoing ?? null;

  const targetView = (
    <div className="space-y-8">
      {incoming && (
        <section data-testid="incoming-claim" className="space-y-3">
          <Alert tone="info">
            {incoming.killerName} says they killed you ({incoming.killMethod.name}).
          </Alert>
          <div className="flex flex-wrap gap-2">
            <ActionForm action={acceptClaimAction.bind(null, gameId, incoming.id)}>
              <SubmitButton className={dangerButtonClass}>Yes, I was killed</SubmitButton>
            </ActionForm>
            <ActionForm action={contestClaimAction.bind(null, gameId, incoming.id)}>
              <SubmitButton className={secondaryButtonClass}>No, contest</SubmitButton>
            </ActionForm>
          </div>
        </section>
      )}

      <div className="space-y-2">
        <StatusChip data-testid="player-status" tone={status.tone} icon={status.icon}>
          {status.label}
        </StatusChip>
        {status.hint && !finished && <p className="text-sm text-muted">{status.hint}</p>}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm text-muted">Your target</h2>
        {finished ? (
          <p data-testid="target-name" className="font-display text-3xl font-semibold">
            This game has finished
          </p>
        ) : assignment ? (
          <>
            <p
              data-testid="target-name"
              className="font-display text-6xl leading-none font-bold break-words"
            >
              {assignment.target.displayName}
            </p>
            <div aria-hidden className="h-0.5 w-16 bg-blood" />
            <p className="text-sm text-muted">
              Assigned {formatDateTime(assignment.assignedAt)}
            </p>
          </>
        ) : (
          <div data-testid="target-name" className="font-display text-3xl font-semibold">
            No target yet
          </div>
        )}
        {!finished && !assignment && (
          <p className="text-sm text-muted">
            {game.status === "SETUP"
              ? "Targets are handed out when the organiser starts the game."
              : "You'll see your target here as soon as one is assigned."}
          </p>
        )}
      </section>

      {active && assignment && (
        <section className="space-y-3 border-t border-line pt-6">
          {outgoing && (
            <p data-testid="claim-status" className="text-sm">
              {outgoingClaimLabel(outgoing.status)}
            </p>
          )}
          {outgoing && isOpenClaim(outgoing.status) ? (
            <ActionForm action={withdrawClaimAction.bind(null, gameId, outgoing.id)}>
              <SubmitButton className={secondaryButtonClass}>Withdraw claim</SubmitButton>
            </ActionForm>
          ) : (
            <ActionForm
              action={fileClaimAction.bind(null, gameId)}
              className="flex flex-wrap items-center gap-2"
            >
              <KillMethodSelect methods={killMethods} />
              <ConfirmSubmit
                label="Register kill"
                confirmLabel="Yes, I killed them"
                message={`Did you kill ${assignment.target.displayName}?`}
                className={primaryButtonClass}
              />
            </ActionForm>
          )}
        </section>
      )}
    </div>
  );

  const playersView = roster && (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold">Players</h2>
      {roster.players.length === 0 ? (
        <EmptyState icon={Users} title="No players yet" />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {roster.players.map((p, i) => {
            const view = rosterStatusView(p.status);
            return (
              <li
                key={i}
                data-testid="roster-row"
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="break-words">{p.displayName}</span>
                <StatusChip data-testid="roster-status" tone={view.tone} icon={view.icon}>
                  {view.label}
                </StatusChip>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const leaderboardView = total && (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold">Leaderboard</h2>
      <PlayerLeaderboard
        total={total}
        rounds={perRound}
        initialRound={parseRoundParam(search.round) ?? null}
      />
    </section>
  );

  const roundsView = (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold">Past rounds</h2>
      {pastRounds.length === 0 ? (
        <EmptyState icon={History} title="No finished rounds">
          Winners appear here after each round ends.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {pastRounds.map((r) => (
            <li key={r.roundNo} data-testid="past-round" className="space-y-0.5 py-3">
              <p className="font-medium">Round {r.roundNo}</p>
              <p className="text-sm text-muted">
                {r.winner ? `Winner: ${r.winner.displayName}` : "No winner"}
                {" · "}
                <span data-testid="past-round-outcome">{roundOutcomeLabel(r)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const requested = typeof search.view === "string" ? search.view : "";
  const initialView = VIEWS.find((v) => v === requested) ?? "target";

  return (
    <GameShell
      gameName={game.name}
      playerName={player.displayName}
      roundNo={game.currentRoundNo}
      initialView={initialView}
      views={{
        target: targetView,
        players: playersView || undefined,
        leaderboard: leaderboardView || undefined,
        rounds: started ? roundsView : undefined,
      }}
      menuLinks={
        <>
          <Link
            href="/me"
            className="flex items-center gap-3 rounded-control px-2 py-2.5 hover:bg-raised"
          >
            <Swords aria-hidden className="size-5 text-muted" />
            My games
          </Link>
          {me.isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-control px-2 py-2.5 hover:bg-raised"
            >
              <ShieldCheck aria-hidden className="size-5 text-muted" />
              Admin console
            </Link>
          )}
        </>
      }
      menuFooter={<SignOutButton />}
    />
  );
}
