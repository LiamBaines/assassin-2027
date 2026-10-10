"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Details / Players / Rings / Leaderboard tabs for one game. */
export function GameNav({ gameId }: { gameId: string }) {
  const pathname = usePathname();
  const base = `/admin/games/${encodeURIComponent(gameId)}`;
  const items = [
    { href: base, label: "Details" },
    { href: `${base}/players`, label: "Players" },
    { href: `${base}/rings`, label: "Rings" },
    { href: `${base}/leaderboard`, label: "Leaderboard" },
  ];

  return (
    <nav aria-label="Game sections" className="flex gap-1 border-b border-zinc-200 text-sm">
      {items.map((item) => {
        const current = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 ${
              current
                ? "border-zinc-900 font-medium text-zinc-900"
                : "border-transparent text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
