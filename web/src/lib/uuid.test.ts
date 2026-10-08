import { describe, expect, it } from "vitest";
import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("accepts a UUID in either case", () => {
    expect(isUuid("3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b")).toBe(true);
    expect(isUuid("3F2B8C1E-9A4D-4E6F-8B7A-1C2D3E4F5A6B")).toBe(true);
  });

  it.each(["", "abc", "3f2b8c1e9a4d4e6f8b7a1c2d3e4f5a6b", "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b/x"])(
    "rejects %s",
    (v) => expect(isUuid(v)).toBe(false),
  );
});
