"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-600">
        The game server may be unavailable. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white"
      >
        Try again
      </button>
    </main>
  );
}
