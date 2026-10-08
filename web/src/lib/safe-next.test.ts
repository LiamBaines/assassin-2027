import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it.each([
    ["/", "/"],
    ["/me", "/me"],
    ["/admin/rings?x=1#top", "/admin/rings?x=1#top"],
  ])("keeps relative path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["me"],
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["/\t/evil.example"],
    ["javascript:alert(1)"],
  ])("falls back to / for %s", (input) => {
    expect(safeNextPath(input)).toBe("/");
  });
});
