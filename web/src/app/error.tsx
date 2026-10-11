"use client";

import { RotateCw, ServerCrash } from "lucide-react";
import { EmptyState, secondaryButtonClass } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <EmptyState
        icon={ServerCrash}
        title="Couldn't reach the game server"
        action={
          <button type="button" onClick={reset} className={`${secondaryButtonClass} mt-2`}>
            <RotateCw aria-hidden className="size-4" />
            Try again
          </button>
        }
      >
        Your game data is safe. Wait a moment and try again.
      </EmptyState>
    </main>
  );
}
