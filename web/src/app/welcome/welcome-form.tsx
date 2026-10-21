"use client";

import { useActionState } from "react";
import { Alert, inputClass, primaryButtonClass } from "@/components/ui";
import type { WelcomeState } from "./actions";

/** `action` is `setProfileAction` with the return path bound by the page. */
export function WelcomeForm({
  action,
}: {
  action: (prev: WelcomeState, formData: FormData) => Promise<WelcomeState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="block text-sm font-medium">Display name</span>
        <input
          name="displayName"
          defaultValue={state.displayName}
          minLength={2}
          maxLength={32}
          required
          autoFocus
          autoComplete="nickname"
          className={inputClass}
        />
        <span className="block text-xs text-muted">
          Other players see this name in every game you join. 2–32 characters.
          You can&apos;t change it later, so use a name people will recognise.
        </span>
      </label>
      {state.error && <Alert>{state.error}</Alert>}
      <button
        type="submit"
        disabled={pending}
        className={`${primaryButtonClass} w-full`}
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
