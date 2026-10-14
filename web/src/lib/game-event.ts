import type { GameEvent } from "@/lib/api-types";

export type EventKind = "kill" | "removed" | "restored" | "round" | "shakeup" | "joined" | "other";

const name = (v: unknown): string => {
  if (v && typeof v === "object" && "displayName" in v) {
    const n = (v as { displayName: unknown }).displayName;
    if (typeof n === "string" && n) return n;
  }
  return "Someone";
};

const methodName = (v: unknown): string | null => {
  if (v && typeof v === "object" && "name" in v) {
    const n = (v as { name: unknown }).name;
    if (typeof n === "string" && n) return n;
  }
  return null;
};

/** Icon kind and one-line text for an event; unknown types get a generic line. */
export function describeEvent(e: Pick<GameEvent, "type" | "data">): { kind: EventKind; text: string } {
  const d = e.data ?? {};
  switch (e.type) {
    case "KILL": {
      const method = methodName(d.method);
      return {
        kind: "kill",
        text: `${name(d.killer)} killed ${name(d.victim)}${method ? ` (${method})` : ""}`,
      };
    }
    case "PLAYER_REMOVED":
      return { kind: "removed", text: `${name(d.player)} was removed from the game` };
    case "PLAYER_RESTORED":
      return { kind: "restored", text: `${name(d.player)} was restored to the game` };
    case "ROUND_STARTED": {
      const count = typeof d.playerCount === "number" ? ` with ${d.playerCount} players` : "";
      return { kind: "round", text: `Round ${d.roundNo} started${count}` };
    }
    case "SHAKEUP":
      return { kind: "shakeup", text: `Targets were reshuffled in round ${d.roundNo}` };
    case "PLAYER_JOINED":
      return { kind: "joined", text: `${name(d.player)} joined the game` };
    default:
      return { kind: "other", text: "Something happened in the game" };
  }
}
