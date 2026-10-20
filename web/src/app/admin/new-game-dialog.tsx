"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Dialog, DialogActions } from "@/components/overlay";
import { primaryButtonClass } from "@/components/ui";
import { createGameAction } from "./actions";
import { GameFields } from "./game-fields";

export function NewGameDialog() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        <Plus aria-hidden className="size-4" />
        New game
      </button>
      <Dialog open={open} onClose={close} title="New game">
        {open && (
          <ActionForm action={createGameAction} className="space-y-4">
            <p className="text-sm text-muted">
              Players sign up with the join code or the join link. A code can&apos;t be shared by
              two games that haven&apos;t finished.
            </p>
            <GameFields />
            <DialogActions onCancel={close}>
              <SubmitButton className={primaryButtonClass} pendingLabel="Creating…">
                Create game
              </SubmitButton>
            </DialogActions>
          </ActionForm>
        )}
      </Dialog>
    </>
  );
}
