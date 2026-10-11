"use client";

import { useActionState } from "react";
import { Alert, inputClass, primaryButtonClass } from "@/components/ui";
import { goToJoinCodeAction, type JoinCodeState } from "./actions";

export function JoinCodeForm() {
  const [state, formAction, pending] = useActionState<JoinCodeState, FormData>(
    goToJoinCodeAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="block text-sm font-medium">Join code</span>
        <input
          name="joinCode"
          defaultValue={state.joinCode}
          minLength={6}
          maxLength={16}
          required
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} font-display text-2xl tracking-widest uppercase`}
        />
      </label>
      {state.error && <Alert>{state.error}</Alert>}
      <button
        type="submit"
        disabled={pending}
        className={`${primaryButtonClass} w-full`}
      >
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
