"use client";

import { Crosshair } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { KillMethodSelect } from "@/components/kill-method-select";
import { Dialog } from "@/components/overlay";
import { dangerButtonClass, iconLabelButtonClass, primaryButtonClass } from "@/components/ui";
import type { KillMethod } from "@/lib/api-types";

type Action = (
  prev: { error?: string },
  formData: FormData,
) => Promise<{ error?: string }>;

/**
 * "Register kill" icon button that reveals the kill-method select with
 * confirm/cancel only once clicked, so the table stays compact.
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
  /** Show a labelled button instead of the compact icon (player view). */
  labelled?: boolean;
  methods: Pick<KillMethod, "id" | "name" | "points">[];
  message: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (labelled) {
    if (!open) {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${primaryButtonClass} inline-flex items-center gap-2`}
        >
          <Crosshair aria-hidden className="size-4" />
          Register kill
        </button>
      );
    }
    return (
      <ActionForm action={action} className="flex flex-wrap items-center gap-2">
        {victimId && <input type="hidden" name="victimId" value={victimId} />}
        <span className="basis-full whitespace-normal text-sm">{message}</span>
        <KillMethodSelect methods={methods} />
        <SubmitButton className={dangerButtonClass} pendingLabel="Registering…">
          Register kill
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted underline hover:text-bone"
        >
          Cancel
        </button>
      </ActionForm>
    );
  }

  // Admin table rows: a dialog keeps the table columns from shifting.
  return (
    <>
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
      <Dialog open={open} onClose={() => setOpen(false)} title="Register kill">
        <ActionForm action={action} className="space-y-4 whitespace-normal">
          {victimId && <input type="hidden" name="victimId" value={victimId} />}
          <p className="text-sm text-muted">{message}</p>
          <KillMethodSelect methods={methods} />
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-muted underline hover:text-bone"
            >
              Cancel
            </button>
            <SubmitButton className={dangerButtonClass} pendingLabel="Registering…">
              Register kill
            </SubmitButton>
          </div>
        </ActionForm>
      </Dialog>
    </>
  );
}
