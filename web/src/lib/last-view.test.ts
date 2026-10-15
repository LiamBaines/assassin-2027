import { describe, expect, it } from "vitest";
import { parseArea, resolveHome } from "./last-view";

const G1 = "work-assassin";
const G2 = "office-league";

describe("resolveHome", () => {
  it("sends an admin who last used admin to /admin", () => {
    expect(resolveHome({ isAdmin: true, gameIds: [G1], lastArea: "admin", lastGame: G1 })).toBe("/admin");
  });
  it("ignores last-area for non-admins", () => {
    expect(resolveHome({ isAdmin: false, gameIds: [G1], lastArea: "admin", lastGame: G1 })).toBe(`/${G1}`);
  });
  it("uses the last game when the player area was last used", () => {
    expect(resolveHome({ isAdmin: true, gameIds: [G1, G2], lastArea: "player", lastGame: G2 })).toBe(`/${G2}`);
  });
  it("falls back to /me when the last game is stale or malformed", () => {
    expect(resolveHome({ isAdmin: false, gameIds: [G1], lastGame: G2 })).toBe("/me");
    expect(resolveHome({ isAdmin: false, gameIds: [G1], lastGame: "nope" })).toBe("/me");
  });
  it("falls back to /join with no games", () => {
    expect(resolveHome({ isAdmin: false, gameIds: [] })).toBe("/join");
    expect(resolveHome({ isAdmin: true, gameIds: [], lastArea: "player" })).toBe("/join");
  });
});

describe("parseArea", () => {
  it("accepts only known values", () => {
    expect(parseArea("admin")).toBe("admin");
    expect(parseArea("player")).toBe("player");
    expect(parseArea("x")).toBeNull();
    expect(parseArea(undefined)).toBeNull();
  });
});
