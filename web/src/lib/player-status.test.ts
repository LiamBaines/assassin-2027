import { describe, expect, it } from "vitest";
import { playerStatusView } from "./player-status";

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
