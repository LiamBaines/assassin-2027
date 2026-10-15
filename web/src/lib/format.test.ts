import { describe, expect, it } from "vitest";
import type { AdminPlayer } from "./api-types";
import { formatRelative, removePlayerMessage } from "./format";

const player = (currentTarget: AdminPlayer["currentTarget"]): AdminPlayer => ({
  id: "p1",
  displayName: "Carol",
  email: "carol@example.com",
  status: "ALIVE",
  joinedAt: "2026-10-08T12:00:00Z",
  currentTarget,
});

describe("removePlayerMessage", () => {
  it("says the assassin inherits the target of a player in the ring", () => {
    expect(removePlayerMessage(player({ id: "p2", displayName: "Dave" }))).toBe(
      "Remove Carol? Their assassin will inherit their target, Dave.",
    );
  });

  it("is a plain question for a player outside the ring", () => {
    expect(removePlayerMessage(player(null))).toBe("Remove Carol?");
  });
});

describe("formatRelative", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const MIN = 60_000;
  const DAY = 86_400_000;

  it("uses the largest whole unit", () => {
    expect(formatRelative(ago(30_000), now)).toBe("just now");
    expect(formatRelative(ago(5 * MIN), now)).toBe("5m ago");
    expect(formatRelative(ago(3 * 60 * MIN), now)).toBe("3h ago");
    expect(formatRelative(ago(2 * DAY), now)).toBe("2d ago");
    expect(formatRelative(ago(45 * DAY), now)).toBe("1mo ago");
    expect(formatRelative(ago(400 * DAY), now)).toBe("1y ago");
  });

  it("treats future and invalid times safely", () => {
    expect(formatRelative(ago(-5 * MIN), now)).toBe("just now");
    expect(formatRelative("nope", now)).toBe("—");
    expect(formatRelative(null, now)).toBe("—");
  });
});
