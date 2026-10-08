import { describe, expect, it } from "vitest";
import type { AdminPlayer } from "./api-types";
import { removePlayerMessage } from "./format";

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
