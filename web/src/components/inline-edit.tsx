"use client";

import { Check, Pencil, X } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { IconButton, inputClass } from "@/components/ui";

/**
 * Value with a pencil that swaps it for an input. Enter saves, Escape cancels.
 * `onSave` resolves to an error message to show inline, or null on success.
 */
export function InlineEdit({
  value,
  label,
  onSave,
  children,
  inputClassName = "",
  maxLength,
}: {
  value: string;
  /** Accessible name, e.g. "game name". */
  label: string;
  onSave: (next: string) => Promise<string | null>;
  /** Display of the current value; defaults to the plain text. */
  children?: ReactNode;
  inputClassName?: string;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function start() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function save() {
    const next = draft.trim();
    if (next === value) return cancel();
    startTransition(async () => {
      const err = await onSave(next);
      if (err) setError(err);
      else cancel();
    });
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1">
        {children ?? <span>{value}</span>}
        <IconButton icon={Pencil} label={`Edit ${label}`} onClick={start} className="size-8" />
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          autoFocus
          aria-label={`Edit ${label}`}
          aria-invalid={error ? true : undefined}
          value={draft}
          maxLength={maxLength}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className={`${inputClass} py-1.5 ${inputClassName}`}
        />
        <IconButton icon={Check} label={`Save ${label}`} onClick={save} disabled={pending} className="size-8" />
        <IconButton icon={X} label="Cancel" onClick={cancel} disabled={pending} className="size-8" />
      </span>
      {error && (
        <span role="alert" className="text-sm text-bone">
          {error}
        </span>
      )}
    </span>
  );
}
