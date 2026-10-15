"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/ui";

/**
 * The target's name, hidden on every load so it can't be read over a
 * shoulder. Visibility is local state only; the eye button toggles it.
 */
export function TargetReveal({ name, assignedAt }: { name: string; assignedAt: string }) {
  const [shown, setShown] = useState(false);

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="min-h-[3.75rem] min-w-0 flex-1">
          {shown ? (
            <p
              data-testid="target-name"
              className="font-display text-6xl leading-none font-bold break-words"
            >
              {name}
            </p>
          ) : (
            <p
              data-testid="target-name-hidden"
              aria-label="Target hidden"
              className="font-display text-6xl leading-none font-bold text-muted select-none"
            >
              <span aria-hidden>••••••</span>
            </p>
          )}
        </div>
        <IconButton
          data-testid="target-toggle"
          icon={shown ? EyeOff : Eye}
          label={shown ? "Hide target" : "Show target"}
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
        />
      </div>
      <div aria-hidden className="h-0.5 w-16 bg-blood" />
      <p className="text-sm text-muted">Assigned {assignedAt}</p>
    </>
  );
}
