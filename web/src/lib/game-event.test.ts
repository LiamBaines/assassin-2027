import { describe, expect, it } from "vitest";
import { describeEvent } from "./game-event";

const p = (displayName: string) => ({ id: "x", displayName });

const admin = (e: Parameters<typeof describeEvent>[0]) => describeEvent(e, "admin");

describe("describeEvent", () => {
  it("hides the killer from players", () => {
    const data = { killer: p("Ann"), victim: p("Bo"), method: { id: 1, name: "Water pistol" } };
    expect(describeEvent({ type: "KILL", data }, "player").text).toBe("Bo was killed (Water pistol)");
    expect(describeEvent({ type: "KILL", data: { victim: p("Bo") } }, "player").text).toBe("Bo was killed");
  });
  it("describes a kill with its method", () => {
    expect(
      admin({
        type: "KILL",
        data: { killer: p("Ann"), victim: p("Bo"), method: { id: 1, name: "Water pistol" } },
      }),
    ).toEqual({ kind: "kill", text: "Ann killed Bo (Water pistol)" });
  });
  it("omits a missing kill method", () => {
    expect(admin({ type: "KILL", data: { killer: p("Ann"), victim: p("Bo") } }).text).toBe(
      "Ann killed Bo",
    );
  });
  it("describes removals, restores and joins", () => {
    expect(admin({ type: "PLAYER_REMOVED", data: { player: p("Cy") } }).text).toBe(
      "Cy was removed from the game",
    );
    expect(admin({ type: "PLAYER_RESTORED", data: { player: p("Cy") } }).kind).toBe("restored");
    expect(admin({ type: "PLAYER_JOINED", data: { player: p("Di") } }).text).toBe(
      "Di joined the game",
    );
  });
  it("describes awarded and docked bonuses", () => {
    expect(
      admin({
        type: "BONUS_AWARDED",
        data: { player: p("Ann"), points: 5, reason: "Best costume" },
      }).text,
    ).toBe("Ann was awarded +5 bonus points: Best costume");
    expect(
      admin({
        type: "BONUS_AWARDED",
        data: { player: p("Ann"), points: -1, reason: "Late", kill: { id: 3, killer: p("Ann"), victim: p("Bo") } },
      }),
    ).toEqual({ kind: "bonus", text: "Ann lost 1 bonus point (for the kill of Bo): Late" });
  });
  it("describes rounds and shakeups", () => {
    expect(admin({ type: "ROUND_STARTED", data: { roundNo: 2, playerCount: 9 } }).text).toBe(
      "Round 2 started with 9 players",
    );
    expect(admin({ type: "SHAKEUP", data: { roundNo: 2 } }).text).toBe(
      "Targets were reshuffled in round 2",
    );
  });
  it("falls back for unknown types and missing names", () => {
    expect(admin({ type: "NEW_THING", data: {} })).toEqual({
      kind: "other",
      text: "Something happened in the game",
    });
    expect(admin({ type: "PLAYER_JOINED", data: {} }).text).toBe("Someone joined the game");
  });
});
