"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, inputClass, primaryButtonClass } from "@/components/ui";
import { joinAction, type JoinState } from "./actions";

export function JoinForm() {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(
    joinAction,
    {},
  );

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
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Join code</span>
        <input
          name="joinCode"
          defaultValue={state.joinCode}
          minLength={6}
          maxLength={16}
          required
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} uppercase`}
        />
      </label>
      {state.error && (
        <Alert>
          {state.error}
          {state.code === "ALREADY_REGISTERED" && (
            <>
              {" "}
              <Link href="/me" className="font-medium underline">
                Go to your page
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
