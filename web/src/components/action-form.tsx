"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Dialog, DialogActions } from "@/components/overlay";
import { DuplicateNamesDialog } from "@/components/duplicate-names-dialog";
import { Alert, iconLabelButtonClass } from "@/components/ui";
import type { PlayerRef } from "@/lib/api-types";

export type ActionResult = {
  error?: string;
  /** Players sharing a name that blocked the action; shown in a dialog where the admin can rename them. */
  duplicates?: PlayerRef[];
};

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

/** A form bound to a Server Action that shows the returned error inline. */
export function ActionForm({
  action,
  children,
  className,
  renameAction,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  /** Lets the admin fix a DUPLICATE_NAMES error on the spot. */
  renameAction?: (playerId: string, displayName: string) => Promise<string | null>;
}) {
  const [state, formAction] = useActionState(action, {});
  const [dismissed, setDismissed] = useState<ActionResult | null>(null);
  return (
    <>
      <form action={formAction} className={className}>
        {children}
        {state.error && (
          <div className="basis-full">
            <Alert>{state.error}</Alert>
          </div>
        )}
      </form>
      {renameAction && state.duplicates && (
        <DuplicateNamesDialog
          key={state.duplicates.map((p) => p.id + p.displayName).join()}
          open={dismissed !== state}
          onClose={() => setDismissed(state)}
          players={state.duplicates}
          rename={renameAction}
        />
      )}
    </>
  );
}

/** Button body: an icon, a label, or just the icon when `iconOnly` (label becomes the accessible name). */
function ButtonFace({
  icon,
  iconOnly,
  pending,
  children,
}: {
  icon?: ReactNode;
  iconOnly?: boolean;
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icon}
      {iconOnly ? <span className="hidden xl:inline">{children}</span> : children}
    </>
  );
}

const labelOf = (children: ReactNode) => (typeof children === "string" ? children : undefined);

/** Submit button that shows a pending state while its form is submitting. */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  icon,
  iconOnly,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  /** An element, not a component: Server Components can pass elements across the boundary. */
  icon?: ReactNode;
  iconOnly?: boolean;
}) {
  const { pending } = useFormStatus();
  const label = pending ? (pendingLabel ?? "Saving…") : children;
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={iconOnly ? labelOf(children) : undefined}
      title={iconOnly ? labelOf(children) : undefined}
      className={iconOnly ? `${iconLabelButtonClass} ${className ?? ""}` : className}
    >
      <ButtonFace icon={icon} iconOnly={iconOnly} pending={pending}>
        {label}
      </ButtonFace>
    </button>
  );
}

/**
 * Two-step submit: the trigger opens a confirmation dialog whose confirm
 * button submits the enclosing form (the dialog sits inside the form in the DOM).
 */
export function ConfirmSubmit({
  label,
  confirmLabel,
  title,
  message,
  className,
  confirmClassName,
  icon,
  iconOnly,
}: {
  /** An element, not a component: Server Components can pass elements across the boundary. */
  icon?: ReactNode;
  iconOnly?: boolean;
  label: string;
  confirmLabel: string;
  /** Dialog heading; defaults to the trigger label. */
  title?: string;
  message: string;
  className?: string;
  confirmClassName?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const { pending } = useFormStatus();
  const close = () => setConfirming(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        className={iconOnly ? `${iconLabelButtonClass} ${className ?? ""}` : className}
      >
        <ButtonFace icon={icon} iconOnly={iconOnly} pending={pending}>
          {pending ? "Working…" : label}
        </ButtonFace>
      </button>
      <Dialog open={confirming} onClose={close} title={title ?? label} description={message}>
        <DialogActions onCancel={close} disabled={pending}>
          <button
            type="submit"
            disabled={pending}
            // Close once the submit has been dispatched; the trigger then
            // shows the pending state.
            onClick={() => setTimeout(close, 0)}
            className={confirmClassName ?? className}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </DialogActions>
      </Dialog>
    </>
  );
}
