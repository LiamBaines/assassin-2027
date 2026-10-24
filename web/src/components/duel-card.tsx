"use client";

import { Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  acceptDuelAction,
  challengeDuelAction,
  confirmDuelAction,
  contestDuelAction,
  declineDuelAction,
  reportDuelAction,
  revokeDuelAction,
} from "@/app/[gameId]/actions";
import { Dialog, DialogActions } from "@/components/overlay";
import {
  Alert,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import type { ActionResult } from "@/components/action-form";
import type { Duel } from "@/lib/api-types";
import {
  DUEL_ACTIVITY_MAX_LENGTH,
  duelActions,
  duelStatusText,
  isDuelOpen,
  isValidActivity,
} from "@/lib/duel";

/** A duel challenge in the thread, with the buttons this player can use right now. */
export function DuelCard({
  gameId,
  duel,
  onChanged,
}: {
  gameId: string;
  duel: Duel;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [reporting, setReporting] = useState(false);
  const actions = duelActions(duel);
  const statusText = duelStatusText(duel);

  function run(fn: () => Promise<ActionResult>) {
    start(async () => {
      const result = await fn();
      setError(result.error ?? null);
      setReporting(false);
      onChanged();
    });
  }

  return (
    <div
      data-testid="duel-card"
      data-status={duel.status}
      className={`max-w-[85%] space-y-2 rounded-panel border px-3 py-2 ${
        duel.challengerIsMe ? "self-end bg-raised" : "self-start"
      } ${isDuelOpen(duel.status) ? "border-blood" : "border-line"}`}
    >
      <p className="flex items-center gap-2 font-display text-lg font-semibold">
        <Swords aria-hidden className="size-4 shrink-0" />
        Duel challenge
      </p>
      <p data-testid="duel-activity" className="break-words">
        {duel.activity}
      </p>
      {statusText && (
        <p data-testid="duel-status" className="text-sm text-muted">
          {statusText}
        </p>
      )}

      {actions.length > 0 && !reporting && (
        <div className="flex flex-wrap gap-2">
          {actions.includes("accept") && (
            <button
              type="button"
              data-testid="duel-accept"
              disabled={pending}
              onClick={() => run(() => acceptDuelAction(gameId, duel.id))}
              className={`${primaryButtonClass} flex-1`}
            >
              Accept
            </button>
          )}
          {actions.includes("decline") && (
            <button
              type="button"
              data-testid="duel-decline"
              disabled={pending}
              onClick={() => run(() => declineDuelAction(gameId, duel.id))}
              className={`${secondaryButtonClass} flex-1`}
            >
              Decline
            </button>
          )}
          {actions.includes("revoke") && (
            <button
              type="button"
              data-testid="duel-revoke"
              disabled={pending}
              onClick={() => run(() => revokeDuelAction(gameId, duel.id))}
              className={secondaryButtonClass}
            >
              Revoke challenge
            </button>
          )}
          {actions.includes("report") && (
            <button
              type="button"
              data-testid="duel-report"
              disabled={pending}
              onClick={() => setReporting(true)}
              className={primaryButtonClass}
            >
              Report the winner
            </button>
          )}
          {actions.includes("confirm") && (
            <button
              type="button"
              data-testid="duel-confirm"
              disabled={pending}
              onClick={() => run(() => confirmDuelAction(gameId, duel.id))}
              className={primaryButtonClass}
            >
              Confirm result
            </button>
          )}
          {actions.includes("contest") && (
            <button
              type="button"
              data-testid="duel-contest"
              disabled={pending}
              onClick={() => run(() => contestDuelAction(gameId, duel.id))}
              className={dangerButtonClass}
            >
              Contest
            </button>
          )}
        </div>
      )}

      {reporting && (
        <div className="space-y-2">
          <p className="text-sm">Who won?</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="duel-report-me"
              disabled={pending}
              onClick={() => run(() => reportDuelAction(gameId, duel.id, "ME"))}
              className={primaryButtonClass}
            >
              I won
            </button>
            <button
              type="button"
              data-testid="duel-report-other"
              disabled={pending}
              onClick={() => run(() => reportDuelAction(gameId, duel.id, "OTHER"))}
              className={dangerButtonClass}
            >
              They won
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setReporting(false)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

/** "Propose duel" on the home screen; shows where an open challenge stands instead once one exists. */
export function ProposeDuel({
  gameId,
  targetName,
  open: openDuel,
}: {
  gameId: string;
  targetName: string | null;
  /** The player's own unresolved challenge, if any. */
  open: Duel | null;
}) {
  const [dialog, setDialog] = useState(false);
  const router = useRouter();

  if (openDuel) {
    return (
      <button
        type="button"
        data-testid="duel-state"
        disabled
        className={`${secondaryButtonClass} w-full`}
      >
        <Swords aria-hidden className="size-4" />
        {openDuel.status === "PENDING" ? "Duel proposed" : "Duel accepted"}
      </button>
    );
  }
  return (
    <>
      <button
        type="button"
        data-testid="duel-propose"
        onClick={() => setDialog(true)}
        className={`${secondaryButtonClass} w-full`}
      >
        <Swords aria-hidden className="size-4" />
        Propose duel
      </button>
      <ChallengeDialog
        gameId={gameId}
        targetName={targetName}
        open={dialog}
        onClose={() => setDialog(false)}
        onSent={() => router.refresh()}
      />
    </>
  );
}

/** Two steps: describe the activity, then confirm that the target will learn who you are. */
export function ChallengeDialog({
  gameId,
  targetName,
  open,
  onClose,
  onSent,
}: {
  gameId: string;
  targetName: string | null;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [activity, setActivity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function close() {
    setStep(1);
    setActivity("");
    setError(null);
    onClose();
  }

  function send() {
    start(async () => {
      const result = await challengeDuelAction(gameId, activity.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      close();
      onSent();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={step === 1 ? "Challenge to a duel" : "Send this challenge?"}
      description={
        step === 1
          ? "Pick what you'll compete at. If they accept, the winner scores a kill."
          : `If accepted, ${targetName ?? "your target"} will learn who you are.`
      }
    >
      {step === 1 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isValidActivity(activity)) setStep(2);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="duel-activity-input" className="text-sm">
              Activity
            </label>
            <input
              id="duel-activity-input"
              data-testid="duel-activity-input"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              maxLength={DUEL_ACTIVITY_MAX_LENGTH + 20}
              placeholder="Arm wrestle in the kitchen"
              className={inputClass}
            />
            <p
              className={`tabular text-sm ${activity.trim().length > DUEL_ACTIVITY_MAX_LENGTH ? "text-blood" : "text-muted"}`}
            >
              {activity.trim().length}/{DUEL_ACTIVITY_MAX_LENGTH}
            </p>
          </div>
          <DialogActions onCancel={close}>
            <button
              type="submit"
              data-testid="duel-next"
              disabled={!isValidActivity(activity)}
              className={primaryButtonClass}
            >
              Next
            </button>
          </DialogActions>
        </form>
      ) : (
        <div className="space-y-4">
          <p data-testid="duel-confirm-activity" className="break-words rounded-control border border-line px-3 py-2">
            {activity.trim()}
          </p>
          {error && <Alert>{error}</Alert>}
          <DialogActions onCancel={() => setStep(1)} disabled={pending} cancelLabel="Back">
            <button
              type="button"
              data-testid="duel-send"
              disabled={pending}
              onClick={send}
              className={primaryButtonClass}
            >
              {pending ? "Sending…" : "Send challenge"}
            </button>
          </DialogActions>
        </div>
      )}
    </Dialog>
  );
}
