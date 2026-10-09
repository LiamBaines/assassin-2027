import { describe, expect, it } from "vitest";
import { isOpenClaim, outgoingClaimLabel } from "./claim-status";

describe("isOpenClaim", () => {
  it("is true only for pending and contested claims", () => {
    expect(isOpenClaim("PENDING")).toBe(true);
    expect(isOpenClaim("CONTESTED")).toBe(true);
    for (const s of ["CONFIRMED", "DISMISSED", "WITHDRAWN", "VOIDED"] as const) {
      expect(isOpenClaim(s)).toBe(false);
    }
  });
});

describe("outgoingClaimLabel", () => {
  it("explains a contested claim is up to the organiser", () => {
    expect(outgoingClaimLabel("CONTESTED")).toMatch(/organiser will decide/);
  });

  it("labels dismissed claims", () => {
    expect(outgoingClaimLabel("DISMISSED")).toMatch(/dismissed/);
  });
});
