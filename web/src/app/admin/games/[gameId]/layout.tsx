import Link from "next/link";
import type { ReactNode } from "react";
import { GameStatusBadge } from "../../game-fields";
import { GameNav } from "./game-nav";
import { loadAdminGame } from "./load-game";

export default async function AdminGameLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ gameId: string }>;
}) {
  const game = await loadAdminGame(params);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/admin" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← All games
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{game.name}</h1>
          <GameStatusBadge game={game} />
        </div>
        <GameNav gameId={game.id} />
      </div>
      {children}
    </div>
  );
}
