import { AlertTriangle, Info, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { formatDateTime, formatRelative } from "@/lib/format";
import { PlayerMenu } from "./player-menu";
import { SignOutButton } from "./sign-out-button";

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
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        <PlayerMenu>
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-control px-2 py-2.5 hover:bg-raised"
            >
              <ShieldCheck aria-hidden className="size-5 text-muted" />
              Admin console
            </Link>
          )}
          <SignOutButton className="flex w-full items-center gap-3 rounded-control px-2 py-2.5 text-left hover:bg-raised" />
        </PlayerMenu>
      </header>
      <div className="space-y-4">{children}</div>
    </main>
  );
}

/** Flat bordered region. Don't nest one Panel inside another; use dividers. */
export function Panel({
  children,
  className = "",
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  /** No padding, for tables and lists that run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section
      className={`rounded-panel border border-line bg-surface ${flush ? "" : "p-4"} ${className}`}
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
  const Icon = tone === "error" ? AlertTriangle : Info;
  const styles =
    tone === "error"
      ? "border-blood/60 bg-blood/10 text-bone"
      : "border-line bg-raised text-bone";
  return (
    <p
      role="alert"
      className={`flex items-start gap-2 rounded-panel border px-3 py-2 text-sm ${styles}`}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export type StatusTone = "alive" | "dead" | "warn" | "neutral";

const toneStyles: Record<StatusTone, string> = {
  alive: "text-alive border-alive/40",
  dead: "text-muted border-line",
  warn: "text-warn border-warn/40",
  neutral: "text-bone border-line",
};

/** Status is always icon + label, never colour alone. */
export function StatusChip({
  tone = "neutral",
  icon: Icon,
  children,
  ...rest
}: {
  tone?: StatusTone;
  icon?: LucideIcon;
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <span
      {...rest}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-control border px-2 py-0.5 text-sm font-medium ${toneStyles[tone]}`}
    >
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </span>
  );
}

/** Say what's missing and what to do next. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 py-8">
      {Icon && <Icon aria-hidden className="size-6 text-muted" />}
      <p className="font-display text-xl font-semibold">{title}</p>
      {children && <p className="max-w-prose text-sm text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-panel bg-raised ${className}`}
    />
  );
}

/** Icon-only button. The label is the accessible name and the hover tooltip. */
export function IconButton({
  icon: Icon,
  label,
  className = "",
  ...rest
}: {
  icon: LucideIcon;
  label: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-10 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-bone disabled:opacity-50 ${className}`}
      {...rest}
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}

export const iconButtonClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-bone disabled:opacity-50";

/** Icon button that also shows its label from the xl breakpoint, where the table has room. */
export const iconLabelButtonClass =
  "inline-flex size-9 shrink-0 items-center justify-center gap-2 rounded-control text-sm text-muted hover:bg-raised hover:text-bone disabled:opacity-50 xl:size-auto xl:h-9 xl:px-3";

export const inputClass =
  "w-full rounded-control border border-line bg-ink px-3 py-2.5 text-base text-bone placeholder:text-muted";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-control bg-blood px-4 py-2.5 font-medium text-bone hover:bg-blood-hover disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-control border border-line bg-raised px-4 py-2 text-sm font-medium text-bone hover:border-muted disabled:opacity-60";

export const dangerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-control border border-blood px-4 py-2 text-sm font-medium text-bone hover:bg-blood/20 disabled:opacity-60";

/** Join codes are the one place monospace is used. */
export function JoinCode({ code, className = "" }: { code: string; className?: string }) {
  return <span className={`font-mono tracking-wide ${className}`}>{code}</span>;
}

/** Short relative age ("2d ago"); the native tooltip shows the full date-time after the browser's hover delay. */
export function RelativeTime({ iso, className = "" }: { iso: string | null | undefined; className?: string }) {
  if (!iso) return <span className={className}>—</span>;
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className}>
      {formatRelative(iso)}
    </time>
  );
}

/**
 * Whole-row click that keeps real link semantics: put `rowLinkClass` on the
 * row's primary <Link> and `clickableRowClass` on the <tr>/<li>. The link's
 * ::after stretches over the row, so middle-click, focus and Enter all work.
 */
export const clickableRowClass = "relative hover:bg-raised focus-within:bg-raised";
export const rowLinkClass = "after:absolute after:inset-0 after:content-['']";
