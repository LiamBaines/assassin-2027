"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Section tabs for one game. */
export function GameNav({ gameId }: { gameId: string }) {
  const pathname = usePathname();
  const base = `/admin/games/${encodeURIComponent(gameId)}`;
  const items = [
    { href: `${base}/leaderboard`, label: "Leaderboard" },
    { href: `${base}/players`, label: "Players" },
    { href: `${base}/settings`, label: "Settings" },
    { href: `${base}/log`, label: "Log" },
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
          </Link>
        );
      })}
    </nav>
  );
}
