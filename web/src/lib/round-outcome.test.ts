import { describe, expect, it } from "vitest";
import { roundOutcomeLabel } from "./round-outcome";

describe("roundOutcomeLabel", () => {
  it("names the killer", () => {
    expect(roundOutcomeLabel({ myOutcome: "KILLED", killedBy: "Ann" })).toBe("Killed by Ann");
  });
  it("falls back when the killer is unknown", () => {
    expect(roundOutcomeLabel({ myOutcome: "KILLED", killedBy: null })).toBe("Killed");
  });
  it("covers survived and out", () => {
    expect(roundOutcomeLabel({ myOutcome: "SURVIVED", killedBy: null })).toBe("Survived");
    expect(roundOutcomeLabel({ myOutcome: "OUT", killedBy: null })).toBe("Sat out");
  });
});
