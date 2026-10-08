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

const createGame = vi.fn();
const setPlayerStatus = vi.fn();
const shuffleRing = vi.fn();
const updateGame = vi.fn();
const joinGame = vi.fn();
const requireAdmin = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/api", () => ({
  isApiError: (e: unknown) => e instanceof ApiError,
  requireAdmin,
  createGame,
  setPlayerStatus,
  shuffleRing,
  updateGame,
  joinGame,
}));

const {
  createGameAction,
  finishGameAction,
  setPlayerStatusAction,
  setSignupsAction,
  shuffleRingAction,
  updateGameAction,
} = await import("./admin/actions");
const { goToJoinCodeAction, joinAction } = await import("./join/actions");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const GAME = "6f1c2b9e-3d4a-4e5f-8a7b-1c2d3e4f5a6b";
const PLAYER = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const fail = (status: number, code: string) =>
  Promise.reject(new ApiError(status, code, `raw ${code}`));

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ isAdmin: true });
});

describe("admin action error messages", () => {
  it.each([
    ["PLAYER_NOT_FOUND", 404, /no longer in the game/],
    ["INVALID_STATUS", 400, /isn't allowed/],
    ["CONCURRENT_UPDATE", 409, /at the same time/],
    ["GAME_FINISHED", 409, /finished/],
    ["GAME_NOT_FOUND", 404, /doesn't exist/],
    ["FORBIDDEN", 403, /isn't an admin/],
  ])("maps %s from a player status change", async (code, status, message) => {
    setPlayerStatus.mockImplementation(() => fail(status, code));
    const result = await setPlayerStatusAction(
      GAME,
      {},
      form({ playerId: PLAYER, status: "REMOVED" }),
    );
    expect(result.error).toMatch(message);
  });

  it("removes a player in the bound game", async () => {
    setPlayerStatus.mockResolvedValue({});
    const result = await setPlayerStatusAction(
      GAME,
      {},
      form({ playerId: PLAYER, status: "REMOVED" }),
    );
    expect(result).toEqual({});
    expect(setPlayerStatus).toHaveBeenCalledWith(GAME, PLAYER, "REMOVED");
  });

  it("maps GAME_FINISHED from a shuffle", async () => {
    shuffleRing.mockImplementation(() => fail(409, "GAME_FINISHED"));
    const result = await shuffleRingAction(GAME, {}, form({ expectedCurrentRoundNo: "1" }));
    expect(result.error).toMatch(/finished/);
    expect(shuffleRing).toHaveBeenCalledWith(GAME, 1);
  });

  it("sends null before the first round", async () => {
    shuffleRing.mockResolvedValue({});
    await shuffleRingAction(GAME, {}, form({ expectedCurrentRoundNo: "" }));
    expect(shuffleRing).toHaveBeenCalledWith(GAME, null);
  });

  it("maps CONCURRENT_UPDATE from finishing a game", async () => {
    updateGame.mockImplementation(() => fail(409, "CONCURRENT_UPDATE"));
    const result = await finishGameAction(GAME);
    expect(result.error).toMatch(/at the same time/);
    expect(updateGame).toHaveBeenCalledWith(GAME, { status: "FINISHED" });
  });

  it("maps JOIN_CODE_TAKEN from an edit and a create", async () => {
    updateGame.mockImplementation(() => fail(409, "JOIN_CODE_TAKEN"));
    const edit = await updateGameAction(GAME, {}, form({ name: "Spring", joinCode: "abc123" }));
    expect(edit.error).toMatch(/already uses that join code/);
    expect(updateGame).toHaveBeenCalledWith(GAME, { name: "Spring", joinCode: "ABC123" });

    createGame.mockImplementation(() => fail(409, "JOIN_CODE_TAKEN"));
    const create = await createGameAction({}, form({ name: "Spring", joinCode: "ABC123" }));
    expect(create.error).toMatch(/already uses that join code/);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("opens the new game's page after a create", async () => {
    createGame.mockResolvedValue({ id: "g 2" });
    await createGameAction({}, form({ name: "Spring", joinCode: "ABC123" }));
    expect(redirect).toHaveBeenCalledWith("/admin/games/g%202");
  });

  it.each([
    ["update", () => updateGameAction("nope", {}, form({ name: "Spring", joinCode: "ABC123" }))],
    ["signups", () => setSignupsAction("../x", {}, form({ signupsOpen: "true" }))],
    ["finish", () => finishGameAction("")],
    ["player status", () => setPlayerStatusAction("g1", {}, form({ playerId: PLAYER, status: "ALIVE" }))],
    ["shuffle", () => shuffleRingAction(`${GAME}/x`, {}, form({ expectedCurrentRoundNo: "" }))],
  ])("rejects a malformed game id for %s without calling the API", async (_name, action) => {
    const result = await action();
    expect(result).toEqual({ error: "Invalid request." });
    expect(requireAdmin).toHaveBeenCalled();
    expect(updateGame).not.toHaveBeenCalled();
    expect(setPlayerStatus).not.toHaveBeenCalled();
    expect(shuffleRing).not.toHaveBeenCalled();
  });

  it("rejects a malformed player id without calling the API", async () => {
    const result = await setPlayerStatusAction(GAME, {}, form({ playerId: "p1", status: "ALIVE" }));
    expect(result).toEqual({ error: "Invalid request." });
    expect(setPlayerStatus).not.toHaveBeenCalled();
  });

  it("checks the caller is an admin before anything else", async () => {
    const notFound = new Error("NEXT_HTTP_ERROR_FALLBACK;404");
    requireAdmin.mockRejectedValue(notFound);
    await expect(createGameAction({}, form({ name: "Spring", joinCode: "ABC123" }))).rejects.toBe(notFound);
    await expect(finishGameAction(GAME)).rejects.toBe(notFound);
    await expect(shuffleRingAction("nope", {}, form({}))).rejects.toBe(notFound);
    expect(createGame).not.toHaveBeenCalled();
    expect(updateGame).not.toHaveBeenCalled();
    expect(shuffleRing).not.toHaveBeenCalled();
  });

  it("falls back to the API detail for unknown codes", async () => {
    setPlayerStatus.mockImplementation(() => fail(409, "SOMETHING_NEW"));
    const result = await setPlayerStatusAction(
      GAME,
      {},
      form({ playerId: PLAYER, status: "ALIVE" }),
    );
    expect(result.error).toBe("raw SOMETHING_NEW");
  });
});

describe("join actions", () => {
  it("sends a valid typed code to its join page", async () => {
    await goToJoinCodeAction({}, form({ joinCode: " abc123 " }));
    expect(redirect).toHaveBeenCalledWith("/join/ABC123");
  });

  it("rejects a malformed typed code without redirecting", async () => {
    const result = await goToJoinCodeAction({}, form({ joinCode: "ab-1" }));
    expect(result.error).toMatch(/6–16 letters or numbers/);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("joins with the bound code and opens the game page", async () => {
    joinGame.mockResolvedValue({ game: { id: "g1" }, player: { id: "p1" } });
    await joinAction("abc123", {}, form({ displayName: " Alice " }));
    expect(joinGame).toHaveBeenCalledWith({ displayName: "Alice", joinCode: "ABC123" });
    expect(redirect).toHaveBeenCalledWith("/games/g1");
  });

  it.each([
    ["EMAIL_REQUIRED", 400, /no email address/],
    ["TOO_MANY_ATTEMPTS", 429, /Too many/],
    ["SIGNUPS_CLOSED", 409, /closed/],
    ["NAME_TAKEN", 409, /already has that name/],
    ["BAD_JOIN_CODE", 400, /isn't valid/],
  ])("maps %s", async (code, status, message) => {
    joinGame.mockImplementation(() => fail(status, code));
    const result = await joinAction("ABC123", {}, form({ displayName: "Alice" }));
    expect(result).toMatchObject({ code, displayName: "Alice" });
    expect(result.error).toMatch(message);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("checks the name length in code points", async () => {
    const result = await joinAction("ABC123", {}, form({ displayName: "A" }));
    expect(result.code).toBe("VALIDATION_FAILED");
    expect(joinGame).not.toHaveBeenCalled();
  });
});
