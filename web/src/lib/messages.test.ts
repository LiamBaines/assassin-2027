import { describe, expect, it } from "vitest";
import type { Message, MessageThread } from "@/lib/api-types";
import { clusterMessages, isValidBody, sortThreads, threadTitle, unreadBadge } from "./messages";

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

const msg = (id: number, iso: string): Message => ({ id, mine: false, body: "x", createdAt: iso, read: true });

describe("clusterMessages", () => {
  it("returns no clusters for no messages", () => {
    expect(clusterMessages([])).toEqual([]);
  });
  it("keeps messages within the gap together and splits after it", () => {
    const a = msg(1, "2026-01-01T10:00:00Z");
    const b = msg(2, "2026-01-01T10:10:00Z");
    const c = msg(3, "2026-01-01T10:20:01Z");
    expect(clusterMessages([a, b, c])).toEqual([[a, b], [c]]);
  });
  it("measures the gap from the previous message, not the cluster start", () => {
    const ms = [msg(1, "2026-01-01T10:00:00Z"), msg(2, "2026-01-01T10:09:00Z"), msg(3, "2026-01-01T10:18:00Z")];
    expect(clusterMessages(ms)).toHaveLength(1);
  });
});

describe("sortThreads", () => {
  const thread = (with_: MessageThread["with"], ...isos: string[]): MessageThread => ({
    with: with_,
    unread: 0,
    messages: isos.map((iso, i) => msg(i, iso)),
  });
  it("puts the latest message first and empty threads last", () => {
    const target = thread("TARGET", "2026-01-01T10:00:00Z");
    const assassin = thread("ASSASSIN", "2026-01-01T09:00:00Z", "2026-01-01T11:00:00Z");
    const empty = thread("TARGET");
    expect(sortThreads([empty, target, assassin])).toEqual([assassin, target, empty]);
  });
});
