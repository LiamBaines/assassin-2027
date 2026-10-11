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
    expect(rosterStatusView("ALIVE")).toMatchObject({ label: "Alive", tone: "alive" });
    expect(rosterStatusView("DEAD")).toMatchObject({ label: "Dead", tone: "dead" });
    expect(rosterStatusView("REMOVED")).toMatchObject({ label: "Removed", tone: "dead" });
    expect(rosterStatusView("WAITING")).toMatchObject({ label: "Waiting", tone: "warn" });
  });
});
