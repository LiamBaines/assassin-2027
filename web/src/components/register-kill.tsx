"use client";

import { Crosshair } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { KillMethodSelect } from "@/components/kill-method-select";
import { Dialog, DialogActions } from "@/components/overlay";
import { dangerButtonClass, iconLabelButtonClass, primaryButtonClass } from "@/components/ui";
import type { KillMethod } from "@/lib/api-types";

type Action = (
  prev: { error?: string },
  formData: FormData,
) => Promise<{ error?: string }>;

/**
 * "Register kill" trigger that opens a dialog with the kill-method select, so
 * neither the player view nor the admin table reflows.
 */
export function RegisterKill({
  action,
  victimId,
  labelled = false,
  methods,
  message,
}: {
  action: Action;
  victimId?: string;
  /** Show a labelled primary button instead of the compact icon (player view). */
  labelled?: boolean;
  methods: Pick<KillMethod, "id" | "name" | "points">[];
  message: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {labelled ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${primaryButtonClass} inline-flex items-center gap-2`}
        >
          <Crosshair aria-hidden className="size-4" />
          Register kill
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Register kill"
          title="Register kill"
          className={iconLabelButtonClass}
        >
          <Crosshair aria-hidden className="size-4" />
          <span className="hidden xl:inline">Register kill</span>
        </button>
      )}
      <Dialog open={open} onClose={close} title="Register kill" description={message}>
        <ActionForm action={action} className="space-y-4 whitespace-normal">
          {victimId && <input type="hidden" name="victimId" value={victimId} />}
          <KillMethodSelect methods={methods} />
          <DialogActions onCancel={close}>
            <SubmitButton className={dangerButtonClass} pendingLabel="Registering…">
              Register kill
            </SubmitButton>
          </DialogActions>
        </ActionForm>
      </Dialog>
    </>
  );
}
