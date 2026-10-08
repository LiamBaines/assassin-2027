"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, inputClass, primaryButtonClass } from "@/components/ui";
import type { JoinState } from "../actions";

/** `action` is `joinAction` with the join code bound by the page. */
export function JoinForm({
  action,
}: {
  action: (prev: JoinState, formData: FormData) => Promise<JoinState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Display name</span>
        <input
          name="displayName"
          defaultValue={state.displayName}
          minLength={2}
          maxLength={32}
          required
          autoComplete="nickname"
          className={inputClass}
        />
        <span className="block text-xs text-zinc-500">
          Other players see this name. 2–32 characters.
        </span>
      </label>
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
