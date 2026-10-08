import { describe, expect, it } from "vitest";
import { joinLink, normalizeJoinCode } from "./join-code";

describe("normalizeJoinCode", () => {
  it("trims and upper-cases a valid code", () => {
    expect(normalizeJoinCode("  abc123 ")).toBe("ABC123");
  });

  it.each(["", "abc", "ABC12345678901234", "ABC-123", "ABC 123", null, undefined])(
    "rejects %s",
    (raw) => {
      expect(normalizeJoinCode(raw)).toBeNull();
    },
  );
});

describe("joinLink", () => {
  it("builds the link without a double slash", () => {
    expect(joinLink("https://x.app/", "ABC123")).toBe("https://x.app/join/ABC123");
  });
});
