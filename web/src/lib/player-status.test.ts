import { describe, expect, it } from "vitest";
import { playerStatusView, rosterStatusView } from "./player-status";

describe("playerStatusView", () => {
  it("shows an alive player in a game that hasn't started as registered", () => {
    expect(playerStatusView("ALIVE", "SETUP").label).toMatch(/Registered/);
  });

  it("notes a finished game for an alive player", () => {
    expect(playerStatusView("ALIVE", "FINISHED")).toMatchObject({
      label: "Alive",
      hint: "The game has finished.",
    });
  });

  it("labels removed and dead players regardless of the game", () => {
    expect(playerStatusView("REMOVED", "ACTIVE").label).toBe("Removed");
    expect(playerStatusView("DEAD", "ACTIVE").label).toBe("Dead");
  });
});

describe("rosterStatusView", () => {
  it("maps each roster status to a label and tone", () => {
    expect(rosterStatusView("ALIVE")).toEqual({ label: "Alive", tone: "bg-emerald-100 text-emerald-800" });
    expect(rosterStatusView("DEAD")).toEqual({ label: "Dead", tone: "bg-red-100 text-red-800" });
    expect(rosterStatusView("REMOVED")).toEqual({ label: "Removed", tone: "bg-zinc-200 text-zinc-800" });
    expect(rosterStatusView("WAITING")).toEqual({ label: "Waiting", tone: "bg-amber-100 text-amber-900" });
  });
});
