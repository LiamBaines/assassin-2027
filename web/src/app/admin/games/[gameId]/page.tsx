import { redirect } from "next/navigation";
import { loadAdminGame } from "./load-game";

export default async function AdminGamePage(props: { params: Promise<{ gameId: string }> }) {
  const game = await loadAdminGame(props.params);
  redirect(`/admin/games/${encodeURIComponent(game.id)}/leaderboard`);
}
