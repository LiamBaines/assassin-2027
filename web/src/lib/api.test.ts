import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getSession } }),
}));

class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}
class NotFoundError extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  notFound: () => {
    throw new NotFoundError();
  },
}));

const {
  ApiError,
  createGame,
  getAdminGame,
  getAdminPlayers,
  getCurrentRing,
  getGamePlayers,
  getMe,
  getMyTarget,
  getRingHistory,
  joinGame,
  listAdminGames,
  previewJoin,
  requireAdmin,
  registerKill,
  setPlayerStatus,
  shuffleRing,
  toApiError,
  updateGame,
} = await import("./api");

const fetchMock = vi.fn<typeof fetch>();

function problem(status: number, body: unknown, contentType = "application/problem+json") {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
}

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", "http://api.test/");
  vi.stubGlobal("fetch", fetchMock);
  getSession.mockResolvedValue({ data: { session: { access_token: "tok-123" } } });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  getSession.mockReset();
});

describe("request plumbing", () => {
  it("sends the bearer token, no-store, and parses JSON", async () => {
    const me = { email: "a@b.c", isAdmin: false, games: [] };
    fetchMock.mockResolvedValue(Response.json(me));

    await expect(getMe()).resolves.toEqual(me);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/me");
    expect(init?.method).toBe("GET");
    expect(init?.cache).toBe("no-store");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
  });

  it("serialises the JSON body on POST", async () => {
    fetchMock.mockResolvedValue(Response.json({ roundNo: 1 }));
    await shuffleRing("g1", null);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/admin/games/g1/rings");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ expectedCurrentRoundNo: null }));
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("redirects to /login without calling the API when there is no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(getMe()).rejects.toMatchObject({ url: "/login" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("error mapping", () => {
  it("redirects to /login on 401", async () => {
    fetchMock.mockResolvedValue(problem(401, { title: "Unauthorized" }));
    await expect(getMe()).rejects.toBeInstanceOf(RedirectError);
    await expect(getMe()).rejects.toMatchObject({ url: "/login" });
  });

  it("maps a ProblemDetail code and detail to ApiError", async () => {
    fetchMock.mockResolvedValue(
      problem(409, {
        type: "about:blank",
        title: "Conflict",
        status: 409,
        detail: "That name is taken",
        code: "NAME_TAKEN",
      }),
    );
    const err = await joinGame({ displayName: "Bob", joinCode: "ABC123" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: "NAME_TAKEN", detail: "That name is taken" });
  });

  it("falls back to title when detail is missing", async () => {
    fetchMock.mockResolvedValue(problem(403, { title: "Forbidden", status: 403 }));
    await expect(getMe()).rejects.toMatchObject({
      status: 403,
      code: "HTTP_403",
      detail: "Forbidden",
    });
  });

  it("handles a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>Bad gateway</html>", { status: 502, statusText: "Bad Gateway" }),
    );
    await expect(getMe()).rejects.toMatchObject({
      status: 502,
      code: "HTTP_502",
      detail: "Bad Gateway",
    });
  });

  it("returns null for the expected 404 code on optional resources", async () => {
    fetchMock.mockResolvedValueOnce(problem(404, { code: "NO_TARGET", detail: "No target" }));
    await expect(getMyTarget("g1")).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(problem(404, { code: "GAME_NOT_FOUND" }));
    await expect(getAdminGame("g-missing")).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(problem(404, { code: "BAD_JOIN_CODE" }));
    await expect(previewJoin("NOPE12")).resolves.toBeNull();
  });

  it("still throws other errors on optional resources", async () => {
    fetchMock.mockResolvedValue(problem(500, { detail: "boom" }));
    await expect(getMyTarget("g1")).rejects.toMatchObject({ status: 500, detail: "boom" });
    fetchMock.mockResolvedValue(problem(404, { code: "SOMETHING_ELSE" }));
    await expect(getMyTarget("g1")).rejects.toMatchObject({ code: "SOMETHING_ELSE" });
    fetchMock.mockResolvedValue(problem(429, { code: "TOO_MANY_ATTEMPTS" }));
    await expect(previewJoin("ABC123")).rejects.toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
  });

  it("toApiError ignores a non-string code", async () => {
    const err = await toApiError(problem(400, { code: 42, detail: "bad" }));
    expect(err).toMatchObject({ status: 400, code: "HTTP_400", detail: "bad" });
  });
});

describe("player contracts", () => {
  it("scopes the target to a game and encodes the id", async () => {
    fetchMock.mockResolvedValue(Response.json({ target: { displayName: "B" }, assignedAt: "t" }));
    await getMyTarget("g/1");
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/me/games/g%2F1/target");
  });

  it("scopes the roster to a game, encodes the id and returns null before the game starts", async () => {
    const roster = { players: [{ displayName: "A", status: "WAITING" }] };
    fetchMock.mockResolvedValueOnce(Response.json(roster));
    await expect(getGamePlayers("g/1")).resolves.toEqual(roster);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/me/games/g%2F1/players");
    fetchMock.mockResolvedValueOnce(problem(404, { code: "GAME_NOT_STARTED" }));
    await expect(getGamePlayers("g1")).resolves.toBeNull();
  });

  it("still throws other roster errors", async () => {
    fetchMock.mockResolvedValueOnce(problem(404, { code: "NOT_IN_GAME" }));
    await expect(getGamePlayers("g1")).rejects.toMatchObject({ code: "NOT_IN_GAME" });
    fetchMock.mockResolvedValueOnce(problem(500, { detail: "boom" }));
    await expect(getGamePlayers("g1")).rejects.toMatchObject({ status: 500 });
  });

  it("previews a join code", async () => {
    const preview = {
      gameId: "g1",
      name: "Spring",
      status: "SETUP",
      signupsOpen: true,
      alreadyJoined: false,
    };
    fetchMock.mockResolvedValue(Response.json(preview));
    await expect(previewJoin("ABC123")).resolves.toEqual(preview);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/join/ABC123");
  });

  it("POSTs the join and returns the game and player", async () => {
    const joined = {
      game: { id: "g1", name: "Spring", status: "SETUP", signupsOpen: true },
      player: { id: "p1", displayName: "Bob", status: "ALIVE", joinedAt: "t" },
    };
    fetchMock.mockResolvedValue(Response.json(joined, { status: 201 }));
    await expect(joinGame({ displayName: "Bob", joinCode: "ABC123" })).resolves.toEqual(joined);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/players");
    expect(init?.body).toBe(JSON.stringify({ displayName: "Bob", joinCode: "ABC123" }));
  });
});

describe("admin contracts", () => {
  it("lists, creates and updates games on the game-scoped routes", async () => {
    fetchMock.mockImplementation(async () => Response.json([]));
    await listAdminGames();
    await createGame({ name: "Spring", joinCode: "ABC123" });
    await updateGame("g1", { status: "FINISHED" });
    const calls = fetchMock.mock.calls.map(([url, init]) => [init?.method, url]);
    expect(calls).toEqual([
      ["GET", "http://api.test/api/admin/games"],
      ["POST", "http://api.test/api/admin/games"],
      ["PATCH", "http://api.test/api/admin/games/g1"],
    ]);
  });

  it("returns the ring in the plan's shape and null before the first round", async () => {
    const ring = {
      roundId: "r1",
      roundNo: 1,
      reason: "INITIAL",
      ring: [
        { assassin: { id: "a", displayName: "A" }, target: { id: "b", displayName: "B" } },
        { assassin: { id: "b", displayName: "B" }, target: { id: "a", displayName: "A" } },
      ],
    };
    fetchMock.mockResolvedValueOnce(Response.json(ring));
    await expect(getCurrentRing("g1")).resolves.toEqual(ring);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/admin/games/g1/rings/current");

    fetchMock.mockResolvedValueOnce(problem(404, { code: "NO_RING" }));
    await expect(getCurrentRing("g1")).resolves.toBeNull();
  });

  it("throws GAME_NOT_FOUND from players and history", async () => {
    fetchMock.mockResolvedValueOnce(problem(404, { code: "GAME_NOT_FOUND" }));
    await expect(getAdminPlayers("g1")).rejects.toMatchObject({ code: "GAME_NOT_FOUND" });
    fetchMock.mockResolvedValueOnce(problem(404, { code: "GAME_NOT_FOUND" }));
    await expect(getRingHistory("g1")).rejects.toMatchObject({ code: "GAME_NOT_FOUND" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://api.test/api/admin/games/g1/players",
      "http://api.test/api/admin/games/g1/rings",
    ]);
  });

  it("PATCHes the player status under its game", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ id: "p 1", displayName: "A", status: "REMOVED", joinedAt: "t" }),
    );
    await setPlayerStatus("g 1", "p 1", "REMOVED");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/admin/games/g%201/players/p%201");
    expect(init?.method).toBe("PATCH");
    expect(init?.body).toBe(JSON.stringify({ status: "REMOVED" }));
  });

  it("POSTs the victim to the game's kills", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          killId: 1,
          killer: { id: "a", displayName: "A" },
          victim: { id: "v", displayName: "V" },
          newTarget: null,
          gameFinished: true,
        },
        { status: 201 },
      ),
    );
    const result = await registerKill("g 1", "v");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/admin/games/g%201/kills");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ victimId: "v" }));
    expect(result.gameFinished).toBe(true);
  });
});

describe("requireAdmin", () => {
  it("returns the caller when they are an admin", async () => {
    const me = { email: "admin@b.c", isAdmin: true, games: [] };
    fetchMock.mockResolvedValue(Response.json(me));
    await expect(requireAdmin()).resolves.toEqual(me);
  });

  it("404s a non-admin before any admin endpoint is called", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ email: "a@b.c", isAdmin: false, games: [] }),
    );
    await expect(requireAdmin()).rejects.toBeInstanceOf(NotFoundError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/me");
  });
});
