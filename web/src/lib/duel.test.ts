import { describe, expect, it } from "vitest";
import type { Duel, KillMethod, Message } from "@/lib/api-types";
import { duelActions, duelAdminStatus, duelInPlay, duelStatusText, isValidActivity, myOpenChallenge } from "./duel";

const duel = (o: Partial<Duel>): Duel => ({
  id: 1,
  status: "PENDING",
  activity: "Darts",
  challengerIsMe: true,
  assassinName: null,
  reportedWinner: null,
  reportedByMe: false,
  ...o,
});
const method = (name: string, enabled: boolean): KillMethod => ({ id: 1, name, points: 15, enabled });
const withDuel = (d: Duel | null): Message => ({
  id: 1, mine: true, kind: d ? "DUEL" : "PLAYER", body: "x", createdAt: "2026-01-01T00:00:00Z", read: true, duel: d,
});

describe("isValidActivity", () => {
  it("trims and enforces 1 to 80", () => {
    expect(isValidActivity("  ")).toBe(false);
    expect(isValidActivity(" Darts ")).toBe(true);
    expect(isValidActivity("a".repeat(80))).toBe(true);
    expect(isValidActivity("a".repeat(81))).toBe(false);
  });
});

describe("duelInPlay", () => {
  it("needs an enabled method named Duel", () => {
    expect(duelInPlay([method(" duel ", true)])).toBe(true);
    expect(duelInPlay([method("Duel", false)])).toBe(false);
    expect(duelInPlay([method("Pistol", true)])).toBe(false);
  });
});

describe("myOpenChallenge", () => {
  it("finds my unresolved challenge only", () => {
    expect(myOpenChallenge([withDuel(null), withDuel(duel({}))])?.id).toBe(1);
    expect(myOpenChallenge([withDuel(duel({ status: "DECLINED" }))])).toBeNull();
    expect(myOpenChallenge([withDuel(duel({ challengerIsMe: false }))])).toBeNull();
  });
});

describe("duelActions", () => {
  it("gives each role its buttons", () => {
    expect(duelActions(duel({}))).toEqual(["revoke"]);
    expect(duelActions(duel({ challengerIsMe: false }))).toEqual(["accept", "decline"]);
    expect(duelActions(duel({ status: "ACCEPTED" }))).toEqual(["report"]);
    expect(duelActions(duel({ status: "REPORTED", reportedByMe: true }))).toEqual([]);
    expect(duelActions(duel({ status: "REPORTED" }))).toEqual(["confirm", "contest"]);
    expect(duelActions(duel({ status: "CONTESTED" }))).toEqual([]);
    expect(duelActions(duel({ status: "COMPLETED" }))).toEqual([]);
  });
});

describe("duelStatusText", () => {
  it("reads from the viewer's side", () => {
    expect(duelStatusText(duel({ status: "REPORTED", reportedWinner: "ME" }))).toBe("They say you won");
    expect(duelStatusText(duel({ status: "REPORTED", reportedWinner: "OTHER" }))).toBe("They say they won");
  });
});

describe("duelAdminStatus", () => {
  const base = {
    id: 1,
    status: "PENDING",
    activity: "chess",
    challenger: { id: "a", displayName: "Ann" },
    challenged: { id: "b", displayName: "Bo" },
    reportedWinner: null,
    createdAt: "2026-01-01T00:00:00Z",
  } as const;

  it("names the reported winner", () => {
    expect(
      duelAdminStatus({ ...base, status: "REPORTED", reportedWinner: base.challenged }),
    ).toBe("Bo reported as the winner");
  });

  it("flags contested duels for the admin", () => {
    expect(duelAdminStatus({ ...base, status: "CONTESTED" })).toMatch(/needs your decision/);
  });
});
