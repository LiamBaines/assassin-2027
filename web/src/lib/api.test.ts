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
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

const { ApiError, getMe, getMyTarget, getAdminGame, joinGame, shuffleRing, toApiError } =
  await import("./api");

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
    const me = { email: "a@b.c", isAdmin: false, game: null, player: null };
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
    await shuffleRing(null);
    const [, init] = fetchMock.mock.calls[0];
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

  it("returns null for 404 on optional resources", async () => {
    fetchMock.mockResolvedValueOnce(problem(404, { code: "NO_TARGET", detail: "No target" }));
    await expect(getMyTarget()).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(problem(404, { code: "NO_LIVE_GAME" }));
    await expect(getAdminGame()).resolves.toBeNull();
  });

  it("still throws non-404 errors on optional resources", async () => {
    fetchMock.mockResolvedValue(problem(500, { detail: "boom" }));
    await expect(getMyTarget()).rejects.toMatchObject({ status: 500, detail: "boom" });
  });

  it("toApiError ignores a non-string code", async () => {
    const err = await toApiError(problem(400, { code: 42, detail: "bad" }));
    expect(err).toMatchObject({ status: 400, code: "HTTP_400", detail: "bad" });
  });
});
