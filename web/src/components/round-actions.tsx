"use client";

import { ChevronDown, RotateCcw, Shuffle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { KillMethodsEditor } from "@/components/kill-methods-editor";
import { Dialog, DialogActions } from "@/components/overlay";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import type { AdminPlayer, KillMethod, RoundReason } from "@/lib/api-types";

type Action = (
  prev: { error?: string },
  formData: FormData,
) => Promise<{ error?: string }>;

const REASON_LABEL: Record<RoundReason, string> = {
  INITIAL: "initial allocation",
  SHAKEUP: "shakeup",
};

type Dlg = "ring" | "round" | null;

const itemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-raised disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent";

/**
 * Admin "Round actions" menu: generate ring / shake up and start next round,
 * each behind a confirm dialog. Remount it (via `key`) when the round or ring
 * changes so a finished action closes its dialog.
 */
export function RoundActions({
  gameActive,
  latestRound,
  ring,
  players,
  killMethods,
  shuffleAction,
  startRoundAction,
}: {
  gameActive: boolean;
  latestRound: { roundNo: number; endedAt: string | null } | null;
  /** Live ring of the open round, or null when there is none. */
  ring: { roundNo: number; gameRoundNo: number; reason: RoundReason } | null;
  players: Pick<AdminPlayer, "id" | "displayName" | "status">[];
  killMethods: KillMethod[];
  shuffleAction: Action;
  startRoundAction: Action;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<Dlg>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [menuOpen]);

  const roundEnded = latestRound?.endedAt != null;
  const canShuffle = gameActive && !roundEnded;
  const canStartRound = gameActive && latestRound !== null;
  const isShakeup = ring !== null;
  const shuffleLabel = isShakeup ? "Shake up" : "Generate ring";

  const shuffleHint = !gameActive
    ? "The game has finished"
    : roundEnded
      ? "Round has ended. Start the next round first"
      : undefined;
  const roundHint = !gameActive
    ? "The game has finished"
    : latestRound === null
      ? "Generate the ring to start round 1"
      : undefined;

  const open = (d: Dlg) => {
    setMenuOpen(false);
    setDialog(d);
  };
  const close = () => setDialog(null);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        className={secondaryButtonClass}
      >
        Round actions
        <ChevronDown aria-hidden className="size-4" />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-64 divide-y divide-line rounded-panel border border-line bg-surface py-1"
        >
          <button
            type="button"
            role="menuitem"
            disabled={!canShuffle}
            title={shuffleHint}
            onClick={() => open("ring")}
            className={itemClass}
          >
            <Shuffle aria-hidden className="size-4" />
            {shuffleLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canStartRound}
            title={roundHint}
            onClick={() => open("round")}
            className={itemClass}
          >
            <RotateCcw aria-hidden className="size-4" />
            Start next round
          </button>
        </div>
      )}

      <Dialog open={dialog === "ring"} onClose={close} title={shuffleLabel}>
        <ActionForm action={shuffleAction} className="space-y-4">
          <p className="text-sm text-muted">
            {ring
              ? `Current: round ${ring.gameRoundNo}, allocation ${ring.roundNo} (${REASON_LABEL[ring.reason]}). A shakeup puts every alive player into a new ring. Current assignments are replaced and kept in history.`
              : "No ring yet. Generating it gives every alive player a target and starts the game."}
          </p>
          <input type="hidden" name="expectedCurrentRoundNo" value={ring?.roundNo ?? ""} />
          {!isShakeup && <KillMethodsEditor methods={killMethods} />}
          <DialogActions onCancel={close}>
<SubmitButton pendingLabel="Working…" className={primaryButtonClass}>
              {isShakeup ? "Yes, shake up" : "Yes, generate"}
            </SubmitButton>
</DialogActions>
        </ActionForm>
      </Dialog>

      {latestRound && (
        <Dialog open={dialog === "round"} onClose={close} title={`Start round ${latestRound.roundNo + 1}`}>
          <ActionForm action={startRoundAction} className="space-y-4">
            <input type="hidden" name="expectedRoundNo" value={latestRound.roundNo} />
            <p className="text-sm text-muted">
              {ring
                ? `Current: round ${ring.gameRoundNo}, allocation ${ring.roundNo} (${REASON_LABEL[ring.reason]}). `
                : `Round ${latestRound.roundNo} has ended. `}
              Tick the players for the new round. Ticked players come back alive;
              unticked players are removed. Current assignments and open claims are closed.
            </p>
            <ul data-testid="round-players" className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {players.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="playerIds" value={p.id} defaultChecked={p.status !== "REMOVED"} />
                    <span>{p.displayName}</span>
                    <span className="text-muted">({p.status.toLowerCase()})</span>
                  </label>
                </li>
              ))}
            </ul>
            <KillMethodsEditor methods={killMethods} />
            <DialogActions onCancel={close}>
<SubmitButton pendingLabel="Starting…" className={primaryButtonClass}>
                Start round {latestRound.roundNo + 1}
              </SubmitButton>
</DialogActions>
          </ActionForm>
        </Dialog>
      )}
    </div>
  );
}
