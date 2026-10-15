import { ArrowLeft, Gamepad2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { listOpenKillClaims } from "@/lib/api";
import { GameStatusBadge } from "../../game-fields";
import { GameNav } from "./game-nav";
import { GameTitle } from "./game-title";
import { loadAdminGame } from "./load-game";

export default async function AdminGameLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ gameId: string }>;
}) {
  const game = await loadAdminGame(params);
  const openClaims = (await listOpenKillClaims(game.id)).length;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-muted hover:text-bone">
            <ArrowLeft aria-hidden className="size-4" />
            Games
          </Link>
          <Link href="/me" className="inline-flex items-center gap-1.5 text-muted hover:text-bone">
            <Gamepad2 aria-hidden className="size-4" />
            Player view
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <GameTitle name={game.name} joinCode={game.joinCode} />
          <GameStatusBadge game={game} />
        </div>
        <GameNav gameId={game.id} openClaims={openClaims} />
      </div>
      {children}
    </div>
  );
}
