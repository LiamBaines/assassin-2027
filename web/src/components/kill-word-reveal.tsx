"use client";

import { Eye, EyeOff } from "lucide-react";
import { IconButton } from "@/components/ui";
import { useHoldReveal } from "@/components/target-reveal";
import type { MyKillWord } from "@/lib/api-types";

/** The assassin's kill word, hidden like the target until the eye is held. Shows "used" once burned. */
export function KillWordReveal({ killWord }: { killWord: MyKillWord }) {
  const { shown, holdProps } = useHoldReveal();

  if (killWord.used || killWord.text === null) {
    return (
      <p data-testid="kill-word-used" className="text-sm text-muted">
        Your kill word has been used this round.
      </p>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        {shown ? (
          <p data-testid="kill-word" className="font-display text-3xl leading-none font-semibold break-words">
            {killWord.text}
          </p>
        ) : (
          <p
            data-testid="kill-word-hidden"
            aria-label="Kill word hidden"
            className="font-display text-3xl leading-none font-semibold text-muted select-none"
          >
            <span aria-hidden>••••••</span>
          </p>
        )}
      </div>
      <IconButton
        data-testid="kill-word-toggle"
        icon={shown ? EyeOff : Eye}
        label="Hold to show kill word"
        className="touch-none select-none"
        {...holdProps}
      />
    </div>
  );
}
