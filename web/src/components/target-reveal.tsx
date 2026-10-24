"use client";

import { Eye, EyeOff } from "lucide-react";
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { useState } from "react";
import { IconButton } from "@/components/ui";

/**
 * Hold-to-reveal state: visibility is local only, and only while the eye is
 * held down (pointer or Space/Enter); releasing, cancelling or blurring hides it.
 * Spread `holdProps` onto the eye button.
 */
export function useHoldReveal() {
  const [shown, setShown] = useState(false);
  const show = () => setShown(true);
  const hide = () => setShown(false);
  const holdProps = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      show();
    },
    onPointerUp: hide,
    onPointerCancel: hide,
    onLostPointerCapture: hide,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") show();
    },
    onKeyUp: (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") hide();
    },
    onBlur: hide,
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  };
  return { shown, holdProps };
}

/** A name hidden behind a hold-to-reveal eye; `testId` goes on the name once revealed. */
export function HiddenName({
  name,
  label,
  testId,
  className = "",
}: {
  name: string;
  label: string;
  testId?: string;
  className?: string;
}) {
  const { shown, holdProps } = useHoldReveal();
  return (
    <span className={`flex min-w-0 items-center gap-1 ${className}`}>
      {shown ? (
        <span data-testid={testId} className="min-w-0 truncate">
          {name}
        </span>
      ) : (
        <span aria-hidden className="text-muted select-none">
          ••••••
        </span>
      )}
      <IconButton
        icon={shown ? EyeOff : Eye}
        label={label}
        className="touch-none select-none"
        {...holdProps}
      />
    </span>
  );
}

/** The target's name, hidden on every load so it can't be read over a shoulder. */
export function TargetReveal({ name, assignedAt }: { name: string; assignedAt: string }) {
  const { shown, holdProps } = useHoldReveal();

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
          {...holdProps}
        />
      </div>
      <div aria-hidden className="h-0.5 w-16 bg-blood" />
      <p className="text-sm text-muted">Assigned {assignedAt}</p>
    </>
  );
}
