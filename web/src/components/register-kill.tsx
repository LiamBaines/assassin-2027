"use client";

import { Crosshair } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { KillMethodSelect } from "@/components/kill-method-select";
import { dangerButtonClass, iconButtonClass, primaryButtonClass } from "@/components/ui";
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

  if (!open && labelled) {
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Register kill"
        title="Register kill"
        className={iconButtonClass}
      >
        <Crosshair aria-hidden className="size-4" />
      </button>
    );
  }

  return (
    <ActionForm action={action} className={`flex flex-wrap items-center gap-2 ${labelled ? "" : "justify-end"}`}>
      {victimId && <input type="hidden" name="victimId" value={victimId} />}
      <span
        className={`basis-full whitespace-normal text-sm ${labelled ? "" : "text-right"}`}
      >{message}</span>
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
