import type { GameStatus, PlayerStatus } from "@/lib/api-types";

export type StatusView = { label: string; tone: string; hint?: string };

/** How a player's own status reads to them, given the state of their game. */
export function playerStatusView(
  player: PlayerStatus,
  game: GameStatus,
): StatusView {
  switch (player) {
    case "REMOVED":
      return {
        label: "Removed",
        tone: "bg-zinc-200 text-zinc-800",
        hint: "The organiser has removed you from the game.",
      };
    case "DEAD":
      return { label: "Dead", tone: "bg-red-100 text-red-800" };
    case "ALIVE":
      if (game === "SETUP") {
        return {
          label: "Registered — waiting for the game to start",
          tone: "bg-amber-100 text-amber-900",
        };
      }
      return {
        label: "Alive",
        tone: "bg-emerald-100 text-emerald-800",
        hint: game === "FINISHED" ? "The game has finished." : undefined,
      };
  }
}

export const GAME_STATUS_LABEL: Record<GameStatus, string> = {
  SETUP: "Not started",
  ACTIVE: "Active",
  FINISHED: "Finished",
};
