import { beforeEach, describe, expect, it, vi } from "vitest";

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string,
  ) {
    super(code);
  }
}

const setPlayerStatus = vi.fn();
const shuffleRing = vi.fn();
const updateGame = vi.fn();
const joinGame = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/api", () => ({
  isApiError: (e: unknown) => e instanceof ApiError,
  createGame: vi.fn(),
  setPlayerStatus,
  shuffleRing,
  updateGame,
  joinGame,
}));

const { finishGameAction, setPlayerStatusAction, shuffleRingAction } = await import(
  "./admin/actions"
);
const { joinAction } = await import("./join/actions");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const fail = (status: number, code: string) =>
  Promise.reject(new ApiError(status, code, `raw ${code}`));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin action error messages", () => {
  it.each([
    ["PLAYER_NOT_FOUND", 404, /no longer in the game/],
    ["INVALID_STATUS", 400, /isn't allowed/],
    ["CONCURRENT_UPDATE", 409, /at the same time/],
  ])("maps %s from a player status change", async (code, status, message) => {
    setPlayerStatus.mockImplementation(() => fail(status, code));
    const result = await setPlayerStatusAction(
      {},
      form({ playerId: "p1", status: "REMOVED" }),
    );
    expect(result.error).toMatch(message);
  });

  it("removes a player without a ring block", async () => {
    setPlayerStatus.mockResolvedValue({});
    const result = await setPlayerStatusAction(
      {},
      form({ playerId: "p1", status: "REMOVED" }),
    );
    expect(result).toEqual({});
    expect(setPlayerStatus).toHaveBeenCalledWith("p1", "REMOVED");
  });

  it("maps GAME_FINISHED from a shuffle", async () => {
    shuffleRing.mockImplementation(() => fail(409, "GAME_FINISHED"));
    const result = await shuffleRingAction({}, form({ expectedCurrentRoundNo: "1" }));
    expect(result.error).toMatch(/finished/);
    expect(shuffleRing).toHaveBeenCalledWith(1);
  });

  it("sends null before the first round", async () => {
    shuffleRing.mockResolvedValue({});
    await shuffleRingAction({}, form({ expectedCurrentRoundNo: "" }));
    expect(shuffleRing).toHaveBeenCalledWith(null);
  });

  it("maps CONCURRENT_UPDATE from a game edit", async () => {
    updateGame.mockImplementation(() => fail(409, "CONCURRENT_UPDATE"));
    const result = await finishGameAction();
    expect(result.error).toMatch(/at the same time/);
  });

  it("falls back to the API detail for unknown codes", async () => {
    setPlayerStatus.mockImplementation(() => fail(409, "SOMETHING_NEW"));
    const result = await setPlayerStatusAction(
      {},
      form({ playerId: "p1", status: "ALIVE" }),
    );
    expect(result.error).toBe("raw SOMETHING_NEW");
  });
});

describe("join action error messages", () => {
  it("maps EMAIL_REQUIRED", async () => {
    joinGame.mockImplementation(() => fail(400, "EMAIL_REQUIRED"));
    const result = await joinAction(
      {},
      form({ displayName: "Alice", joinCode: "abc123" }),
    );
    expect(result).toMatchObject({ code: "EMAIL_REQUIRED" });
    expect(result.error).toMatch(/no email address/);
    expect(joinGame).toHaveBeenCalledWith({ displayName: "Alice", joinCode: "ABC123" });
  });
});
