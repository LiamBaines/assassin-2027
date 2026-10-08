import Link from "next/link";
import type { ReactNode } from "react";

/** Mobile-first single-column page used by the player views. */
export function PlayerShell({
  title,
  children,
  isAdmin = false,
}: {
  title: string;
  children: ReactNode;
  isAdmin?: boolean;
}) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {isAdmin && (
          <Link
            href="/admin"
            className="text-sm font-medium text-zinc-600 underline"
          >
            Admin
          </Link>
        )}
      </header>
      <div className="space-y-4">{children}</div>
    </main>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function Alert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "info";
}) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-sky-200 bg-sky-50 text-sky-900";
  return (
    <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

export const primaryButtonClass =
  "rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white hover:bg-zinc-800 disabled:opacity-60";

export const secondaryButtonClass =
  "rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60";

export const dangerButtonClass =
  "rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60";
