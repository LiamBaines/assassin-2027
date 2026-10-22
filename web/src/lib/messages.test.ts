import { describe, expect, it } from "vitest";
import { isValidBody, threadTitle, unreadBadge } from "./messages";

describe("unreadBadge", () => {
  it("shows no bubble at zero", () => {
    expect(unreadBadge(0)).toEqual({ text: null, label: "Inbox" });
  });
  it("shows the count and puts it in the label", () => {
    expect(unreadBadge(1)).toEqual({ text: "1", label: "Inbox, 1 unread message" });
    expect(unreadBadge(9).text).toBe("9");
  });
  it("caps at 9+", () => {
    expect(unreadBadge(10)).toEqual({ text: "9+", label: "Inbox, 10 unread messages" });
  });
});

describe("threadTitle", () => {
  it("names the role, never a person", () => {
    expect(threadTitle("TARGET")).toBe("Your target");
    expect(threadTitle("ASSASSIN")).toBe("Your assassin");
  });
});

describe("isValidBody", () => {
  it("trims and enforces 1 to 280", () => {
    expect(isValidBody("   ")).toBe(false);
    expect(isValidBody(" hi ")).toBe(true);
    expect(isValidBody("a".repeat(280))).toBe(true);
    expect(isValidBody("a".repeat(281))).toBe(false);
  });
});
