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
const createProfile = vi.fn();
const registerKill = vi.fn();
const requireAdmin = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/api", () => ({
  isApiError: (e: unknown, code?: string) =>
    e instanceof ApiError && (code === undefined || e.code === code),
  requireAdmin,
  createGame,
  setPlayerStatus,
  shuffleRing,
  updateGame,
  joinGame,
  createProfile,
  registerKill,
}));

const {
  createGameAction,
  finishGameAction,
  registerKillAction,
  setPlayerStatusAction,
  shuffleRingAction,
} = await import("./admin/actions");
const { goToJoinCodeAction, joinAction } = await import("./join/actions");
const { setProfileAction } = await import("./welcome/actions");

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
    expect(shuffleRing).toHaveBeenCalledWith(GAME, 1, undefined, undefined);
  });

  it("sends null before the first round", async () => {
    shuffleRing.mockResolvedValue({});
    await shuffleRingAction(GAME, {}, form({ expectedCurrentRoundNo: "" }));
    expect(shuffleRing).toHaveBeenCalledWith(GAME, null, undefined, undefined);
  });

  it("passes the edited kill methods when generating the first ring", async () => {
    shuffleRing.mockResolvedValue({});
    await shuffleRingAction(
      GAME,
      {},
      form({
        expectedCurrentRoundNo: "",
        "method.0.id": "2",
        "method.0.name": "Clamp",
        "method.0.points": "12",
        "method.0.enabled": "on",
      }),
    );
    expect(shuffleRing).toHaveBeenCalledWith(GAME, null, [
      { id: 2, name: "Clamp", points: 12, enabled: true },
    ], undefined);
  });

  it("rejects an invalid kill method row without calling the API", async () => {
    const result = await shuffleRingAction(
      GAME,
      {},
      form({ expectedCurrentRoundNo: "", "method.0.name": "", "method.0.points": "1" }),
    );
    expect(result.error).toMatch(/needs a name/);
    expect(shuffleRing).not.toHaveBeenCalled();
  });

  it("requires a kill method to register a kill", async () => {
    const result = await registerKillAction(GAME, {}, form({ victimId: PLAYER }));
    expect(result.error).toMatch(/kill method/);
    expect(registerKill).not.toHaveBeenCalled();
  });

  it("registers a kill with the chosen method and maps a disabled one", async () => {
    registerKill.mockImplementation(() => fail(409, "KILL_METHOD_DISABLED"));
    const result = await registerKillAction(GAME, {}, form({ victimId: PLAYER, killMethodId: "3" }));
    expect(registerKill).toHaveBeenCalledWith(GAME, PLAYER, 3);
    expect(result.error).toMatch(/disabled/);
  });

  it("maps CONCURRENT_UPDATE from finishing a game", async () => {
    updateGame.mockImplementation(() => fail(409, "CONCURRENT_UPDATE"));
    const result = await finishGameAction(GAME);
    expect(result.error).toMatch(/at the same time/);
    expect(updateGame).toHaveBeenCalledWith(GAME, { status: "FINISHED" });
  });

  it("maps JOIN_CODE_TAKEN from a create", async () => {
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
    await joinAction("abc123");
    expect(joinGame).toHaveBeenCalledWith({ joinCode: "ABC123" });
    expect(redirect).toHaveBeenCalledWith("/g1");
  });

  it.each([
    ["EMAIL_REQUIRED", 400, /no email address/],
    ["TOO_MANY_ATTEMPTS", 429, /Too many/],
    ["SIGNUPS_CLOSED", 409, /closed/],
    ["PROFILE_REQUIRED", 400, /Set your display name/],
    ["BAD_JOIN_CODE", 400, /isn't valid/],
  ])("maps %s", async (code, status, message) => {
    joinGame.mockImplementation(() => fail(status, code));
    const result = await joinAction("ABC123");
    expect(result).toMatchObject({ code });
    expect(result.error).toMatch(message);
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("setProfileAction", () => {
  it("saves the trimmed name and continues to the bound path", async () => {
    createProfile.mockResolvedValue({ displayName: "Alice" });
    await setProfileAction("/join/ABC123", {}, form({ displayName: " Alice " }));
    expect(createProfile).toHaveBeenCalledWith("Alice");
    expect(redirect).toHaveBeenCalledWith("/join/ABC123");
  });

  it("never redirects off-site", async () => {
    createProfile.mockResolvedValue({ displayName: "Alice" });
    await setProfileAction("//evil.com", {}, form({ displayName: "Alice" }));
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("carries on when the name was already set", async () => {
    createProfile.mockImplementation(() => fail(409, "PROFILE_EXISTS"));
    await setProfileAction("/me", {}, form({ displayName: "Alice" }));
    expect(redirect).toHaveBeenCalledWith("/me");
  });

  it("checks the name length in code points", async () => {
    const short = await setProfileAction("/", {}, form({ displayName: "A" }));
    expect(short).toMatchObject({ displayName: "A" });
    expect(short.error).toMatch(/2–32/);
    await setProfileAction("/", {}, form({ displayName: "\u{1F52A}\u{1F52A}" }));
    expect(createProfile).toHaveBeenCalledTimes(1);
  });

  it("explains an invalid name from the API and keeps it in the field", async () => {
    createProfile.mockImplementation(() => fail(400, "INVALID_DISPLAY_NAME"));
    const result = await setProfileAction("/", {}, form({ displayName: "Al\u200Bice" }));
    expect(result.error).toMatch(/visible characters/);
    expect(result.displayName).toBe("Al\u200Bice");
    expect(redirect).not.toHaveBeenCalled();
  });
});
