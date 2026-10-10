import { describe, expect, it } from "vitest";
import { leaderboardHref, parseRoundParam } from "./leaderboard";

describe("parseRoundParam", () => {
  it("accepts positive integers", () => {
    expect(parseRoundParam("1")).toBe(1);
    expect(parseRoundParam("12")).toBe(12);
  });

  it.each([undefined, "", "0", "-1", "1.5", "abc", "01", "1e3", "9999999999"])(
    "treats %j as the game total",
    (v) => expect(parseRoundParam(v)).toBeUndefined(),
  );

  it("ignores repeated params", () => {
    expect(parseRoundParam(["1", "2"])).toBeUndefined();
  });
});

describe("leaderboardHref", () => {
  it("links to the total without a query", () => {
    expect(leaderboardHref("/games/g1/leaderboard", null)).toBe("/games/g1/leaderboard");
  });

  it("links to a round", () => {
    expect(leaderboardHref("/games/g1/leaderboard", 2)).toBe("/games/g1/leaderboard?round=2");
  });
});
