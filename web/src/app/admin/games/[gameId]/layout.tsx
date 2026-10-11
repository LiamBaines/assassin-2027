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
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold">{game.name}</h1>
          <GameStatusBadge game={game} />
        </div>
        <GameNav gameId={game.id} />
      </div>
      {children}
    </div>
  );
}
