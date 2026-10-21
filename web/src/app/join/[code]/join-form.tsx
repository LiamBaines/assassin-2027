"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, primaryButtonClass } from "@/components/ui";
import type { JoinState } from "../actions";

/** `action` is `joinAction` with the join code bound by the page. */
export function JoinForm({
  action,
  displayName,
}: {
  action: (prev: JoinState) => Promise<JoinState>;
  displayName: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted">
        You&apos;ll play as <span className="font-medium text-bone">{displayName}</span>.
      </p>
      {state.error && (
        <Alert>
          {state.error}
          {state.code === "ALREADY_REGISTERED" && (
            <>
              {" "}
              <Link href="/me" className="font-medium underline">
                Go to my games
              </Link>
            </>
          )}
        </Alert>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`${primaryButtonClass} w-full`}
      >
        {pending ? "Joining…" : "Join the game"}
      </button>
    </form>
  );
}
