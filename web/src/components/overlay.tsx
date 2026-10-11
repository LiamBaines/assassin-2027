"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "./ui";

/** Native <dialog> wrapper: focus trap, Esc to close, backdrop click to close. */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return {
    ref,
    onClose,
    onClick: (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === ref.current) onClose();
    },
  };
}

/** Side sheet for secondary navigation (hamburger menu). */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const dialog = useDialog(open, onClose);
  return (
    <dialog
      {...dialog}
      aria-label={title}
      className="m-0 mr-0 ml-auto h-dvh max-h-none w-[min(20rem,85vw)] border-l border-line bg-surface p-0 text-bone backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <IconButton icon={X} label="Close" onClick={onClose} />
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}

/** Centred modal for confirmations and short forms. */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const dialog = useDialog(open, onClose);
  return (
    <dialog
      {...dialog}
      aria-label={title}
      className="m-auto w-[min(28rem,92vw)] rounded-panel border border-line bg-surface p-0 text-bone backdrop:bg-black/60"
    >
      <div className="space-y-4 p-5">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
