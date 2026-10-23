"use client";

import { Award } from "lucide-react";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Dialog, DialogActions } from "@/components/overlay";
import { Select } from "@/components/select";
import { inputClass, primaryButtonClass } from "@/components/ui";

type Action = (
  prev: { error?: string },
  formData: FormData,
) => Promise<{ error?: string }>;

/** "Award points" trigger that opens a dialog: player, amount, reason and an optional kill. */
export function AwardBonus({
  action,
  players,
  kills,
}: {
  action: Action;
  players: { id: string; displayName: string }[];
  /** Kills newest first, already labelled. */
  kills: { id: number; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  // Bumped after a successful award so the next one starts from an empty form.
  const [formKey, setFormKey] = useState(0);
  const close = () => setOpen(false);
  const submit: Action = async (prev, formData) => {
    const result = await action(prev, formData);
    if (!result.error) {
      close();
      setFormKey((k) => k + 1);
    }
    return result;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={primaryButtonClass}
        data-testid="award-bonus-open"
      >
        <Award aria-hidden className="size-4" />
        Award points
      </button>
      <Dialog
        open={open}
        onClose={close}
        title="Award points"
        description="Use a negative amount to dock points. A bonus can't be undone; fix a mistake with an opposite bonus."
      >
        <ActionForm key={formKey} action={submit} className="space-y-4">
          <Select
            name="playerId"
            required
            aria-label="Player"
            data-testid="bonus-player"
            placeholder="Player…"
            options={players.map((p) => ({ value: p.id, label: p.displayName }))}
          />
          <input
            name="points"
            type="number"
            required
            min={-100}
            max={100}
            step={1}
            inputMode="numeric"
            aria-label="Points"
            placeholder="Points (-100 to 100)"
            data-testid="bonus-points"
            className={`${inputClass} tabular`}
          />
          <input
            name="reason"
            type="text"
            required
            maxLength={140}
            aria-label="Reason"
            placeholder="Reason"
            data-testid="bonus-reason"
            className={inputClass}
          />
          <Select
            name="killId"
            aria-label="Linked kill (optional)"
            data-testid="bonus-kill"
            placeholder="Linked kill (optional)…"
            options={[
              { value: "", label: "No linked kill" },
              ...kills.map((k) => ({ value: String(k.id), label: k.label })),
            ]}
          />
          <DialogActions onCancel={close}>
            <SubmitButton className={primaryButtonClass} pendingLabel="Awarding…">
              Award points
            </SubmitButton>
          </DialogActions>
        </ActionForm>
      </Dialog>
    </>
  );
}
