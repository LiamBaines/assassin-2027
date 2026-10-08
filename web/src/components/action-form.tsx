"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui";

export type ActionResult = { error?: string };

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/** A form bound to a Server Action that shows the returned error inline. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && (
        <div className="basis-full">
          <Alert>{state.error}</Alert>
        </div>
      )}
    </form>
  );
}

/** Submit button that shows a pending label while its form is submitting. */
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

/**
 * Two-step submit: the first click asks for confirmation, the second submits
 * the enclosing form.
 */
export function ConfirmSubmit({
  label,
  confirmLabel,
  message,
  className,
  confirmClassName,
}: {
  label: string;
  confirmLabel: string;
  message: string;
  className?: string;
  confirmClassName?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const { pending } = useFormStatus();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className={className}
      >
        {pending ? "Working…" : label}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-sm text-zinc-700">{message}</span>
      <button
        type="submit"
        disabled={pending}
        // Collapse once the submit has been dispatched; the first button then
        // shows the pending state.
        onClick={() => setTimeout(() => setConfirming(false), 0)}
        className={confirmClassName ?? className}
      >
        {pending ? "Working…" : confirmLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="text-sm text-zinc-600 underline"
      >
        Cancel
      </button>
    </span>
  );
}
