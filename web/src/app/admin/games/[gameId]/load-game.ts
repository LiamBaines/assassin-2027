import "server-only";
import { notFound } from "next/navigation";
import { getAdminGame, requireAdmin, type AdminGame } from "@/lib/api";
import { isUuid } from "@/lib/uuid";

/**
 * The admin gate plus the game from the URL, or a 404. Every page under
 * /admin/games/[gameId] calls this itself, because the layout renders
 * concurrently with the page.
 */
export async function loadAdminGame(
  params: Promise<{ gameId: string }>,
): Promise<AdminGame> {
  const { gameId } = await params;
  await requireAdmin();
  if (!isUuid(gameId)) notFound();
  const game = await getAdminGame(gameId);
  if (!game) notFound();
  return game;
}
