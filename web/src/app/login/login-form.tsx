"use client";

import { useActionState, type ReactNode } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { step: "email" };

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";
const buttonClass =
  "w-full rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white disabled:opacity-60";

export function LoginForm({
  initialError,
  next,
}: {
  initialError?: string;
  /** Sanitised path to return to after login; carried through every step. */
  next: string;
}) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );
  const error = state.error ?? (state === initialState ? initialError : undefined);

  if (state.step === "code") {
    return (
      <form action={formAction} className="space-y-4">
        <p className="text-sm text-zinc-600">
          Check your email. We sent a login link and a 6-digit code to{" "}
          <span className="font-medium text-zinc-900">{state.email}</span>.
          Open the link, or enter the code here.
        </p>
        <input type="hidden" name="email" value={state.email} />
        <input type="hidden" name="next" value={next} />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">6-digit code</span>
          <input
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            className={`${inputClass} tracking-[0.4em]`}
          />
        </label>
        {error && <ErrorText>{error}</ErrorText>}
        <button
          type="submit"
          name="intent"
          value="verify"
          disabled={pending}
          className={buttonClass}
        >
          {pending ? "Checking…" : "Log in"}
        </button>
        <button
          type="submit"
          name="intent"
          value="restart"
          formNoValidate
          disabled={pending}
          className="w-full text-sm text-zinc-600 underline"
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          defaultValue={state.email}
          required
          autoFocus
          className={inputClass}
        />
      </label>
      {error && <ErrorText>{error}</ErrorText>}
      <button
        type="submit"
        name="intent"
        value="send"
        disabled={pending}
        className={buttonClass}
      >
        {pending ? "Sending…" : "Email me a login link"}
      </button>
    </form>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-red-700">
      {children}
    </p>
  );
}
