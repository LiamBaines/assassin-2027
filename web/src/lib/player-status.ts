import { Clock, Heart, Skull, UserX, type LucideIcon } from "lucide-react";
import type { StatusTone } from "@/components/ui";
import type { GameStatus, PlayerStatus, RosterStatus } from "@/lib/api-types";

export type StatusView = {
  label: string;
  tone: StatusTone;
  icon: LucideIcon;
  hint?: string;
};

/** How a player's own status reads to them, given the state of their game. */
export function playerStatusView(
  player: PlayerStatus,
  game: GameStatus,
): StatusView {
  switch (player) {
    case "REMOVED":
      return {
        label: "Removed",
        tone: "dead",
        icon: UserX,
        hint: "The organiser has removed you from the game.",
      };
    case "DEAD":
      return { label: "Dead", tone: "dead", icon: Skull };
    case "ALIVE":
      if (game === "SETUP") {
        return {
          label: "Registered, waiting for the game to start",
          tone: "warn",
          icon: Clock,
        };
      }
      return {
        label: "Alive",
        tone: "alive",
        icon: Heart,
        hint: game === "FINISHED" ? "The game has finished." : undefined,
      };
  }
}

/** How a player reads in the roster everyone in the game can see. */
export function rosterStatusView(status: RosterStatus): StatusView {
  switch (status) {
    case "ALIVE":
      return { label: "Alive", tone: "alive", icon: Heart };
    case "DEAD":
      return { label: "Dead", tone: "dead", icon: Skull };
    case "REMOVED":
      return { label: "Removed", tone: "dead", icon: UserX };
    case "WAITING":
      return { label: "Waiting", tone: "warn", icon: Clock };
  }
}

export const GAME_STATUS_LABEL: Record<GameStatus, string> = {
  SETUP: "Not started",
  ACTIVE: "Active",
  FINISHED: "Finished",
};
