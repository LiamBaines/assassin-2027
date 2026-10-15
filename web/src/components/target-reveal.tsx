"use client";

import { Eye, EyeOff } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useState } from "react";
import { IconButton } from "@/components/ui";

/**
 * The target's name, hidden on every load so it can't be read over a
 * shoulder. Visibility is local state only, and only while the eye is held
 * down (pointer or Space/Enter); releasing, cancelling or blurring hides it.
 */
export function TargetReveal({ name, assignedAt }: { name: string; assignedAt: string }) {
  const [shown, setShown] = useState(false);
  const show = () => setShown(true);
  const hide = () => setShown(false);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") show();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") hide();
  };

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
          label="Hold to show target"
          className="touch-none select-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            show();
          }}
          onPointerUp={hide}
          onPointerCancel={hide}
          onLostPointerCapture={hide}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onBlur={hide}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      <div aria-hidden className="h-0.5 w-16 bg-blood" />
      <p className="text-sm text-muted">Assigned {assignedAt}</p>
    </>
  );
}
