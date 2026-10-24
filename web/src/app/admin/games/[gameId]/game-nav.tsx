"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Section tabs for one game. */
export function GameNav({
  gameId,
  openClaims = 0,
  killWords = false,
}: {
  gameId: string;
  openClaims?: number;
  /** Show the Kill words tab (Death Sentence is enabled). */
  killWords?: boolean;
}) {
  const pathname = usePathname();
  const base = `/admin/games/${encodeURIComponent(gameId)}`;
  const items = [
    { href: `${base}/leaderboard`, label: "Leaderboard", badge: 0 },
    { href: `${base}/players`, label: "Players", badge: 0 },
    ...(killWords
      ? [{ href: `${base}/kill-words`, label: "Kill words", badge: 0 }]
      : []),
    { href: `${base}/bonuses`, label: "Bonuses", badge: 0 },
    { href: `${base}/messages`, label: "Messages", badge: 0 },
    { href: `${base}/settings`, label: "Settings", badge: 0 },
    { href: `${base}/log`, label: "Log", badge: openClaims },
  ];

  return (
    <nav
      aria-label="Game sections"
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 text-sm md:-mx-8 md:px-8"
    >
      {items.map((item) => {
        const current = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 whitespace-nowrap ${
              current
                ? "border-blood font-medium text-bone"
                : "border-transparent text-muted hover:text-bone"
            }`}
          >
            {item.label}
            {item.badge > 0 && (
              <span
                data-testid="kills-badge"
                className="tabular ml-2 inline-block min-w-5 rounded-full bg-blood px-1.5 text-center text-xs font-medium text-bone"
              >
                <span aria-hidden>{item.badge}</span>
                <span className="sr-only">
                  {item.badge} unresolved kill {item.badge === 1 ? "claim" : "claims"}
                </span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
