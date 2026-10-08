import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  AdminGame,
  AdminPlayer,
  CreateGameRequest,
  JoinPreview,
  JoinRequest,
  Me,
  MyGame,
  MyTarget,
  PlayerSummary,
  Ring,
  RoundSummary,
  UpdateGameRequest,
} from "@/lib/api-types";

export type * from "@/lib/api-types";

/** A non-2xx API response, mapped from an RFC 9457 ProblemDetail body. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;

  constructor(status: number, code: string, detail: string) {
    super(`${status} ${code}: ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export function isApiError(e: unknown, code?: string): e is ApiError {
  return e instanceof ApiError && (code === undefined || e.code === code);
}

/** Builds an ApiError from a failed response, tolerating non-JSON bodies. */
export async function toApiError(res: Response): Promise<ApiError> {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await res.json();
    if (parsed && typeof parsed === "object") {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    // Not JSON (for example a proxy error page). Fall back to the status.
  }
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  return new ApiError(
    res.status,
    str(body.code) ?? `HTTP_${res.status}`,
    str(body.detail) ?? str(body.title) ?? (res.statusText || "Request failed"),
  );
}

async function accessToken(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) redirect("/login");
  return token;
}

async function request<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) throw new Error("API_BASE_URL is not set");
  const token = await accessToken();

  const headers: Record<string, string> = {
    Authorization: "Bearer " + token,
    Accept: "application/json, application/problem+json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(baseUrl.replace(/\/+$/, "") + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (res.status === 401) redirect("/login");
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Resolves to null when the API answers with the given error code, rethrows anything else. */
async function nullOn<T>(code: string, p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ApiError && e.code === code) return null;
    throw e;
  }
}

const seg = encodeURIComponent;
const gamePath = (gameId: string) => `/api/admin/games/${seg(gameId)}`;

// Player

/** The signed-in user. Deduplicated per request, so layouts and pages can both call it. */
export const getMe = cache(() => request<Me>("GET", "/api/me"));

/**
 * 404s unless the caller is an admin. Next renders a layout and its page
 * concurrently, so every admin page must call this before it fetches admin
 * data, not just the admin layout.
 */
export async function requireAdmin(): Promise<Me> {
  const me = await getMe();
  if (!me.isAdmin) notFound();
  return me;
}

/** The live game behind a join code, or null when the code is unknown (BAD_JOIN_CODE). */
export const previewJoin = (code: string) =>
  nullOn(
    "BAD_JOIN_CODE",
    request<JoinPreview>("GET", `/api/join/${seg(code)}`),
  );

export const joinGame = (req: JoinRequest) =>
  request<MyGame>("POST", "/api/players", req);

/** The caller's current target in a game, or null when they have none (NO_TARGET). */
export const getMyTarget = (gameId: string) =>
  nullOn(
    "NO_TARGET",
    request<MyTarget>("GET", `/api/me/games/${seg(gameId)}/target`),
  );

// Admin

/** Every game, newest first, including finished ones. */
export const listAdminGames = () =>
  request<AdminGame[]>("GET", "/api/admin/games");

/**
 * One game, or null when it doesn't exist (GAME_NOT_FOUND). Deduplicated per
 * request, so the game layout and its pages can both call it.
 */
export const getAdminGame = cache((gameId: string) =>
  nullOn("GAME_NOT_FOUND", request<AdminGame>("GET", gamePath(gameId))),
);

export const createGame = (req: CreateGameRequest) =>
  request<AdminGame>("POST", "/api/admin/games", req);

export const updateGame = (gameId: string, req: UpdateGameRequest) =>
  request<AdminGame>("PATCH", gamePath(gameId), req);

export const getAdminPlayers = (gameId: string) =>
  request<AdminPlayer[]>("GET", `${gamePath(gameId)}/players`);

export const setPlayerStatus = (
  gameId: string,
  playerId: string,
  status: "ALIVE" | "REMOVED",
) =>
  request<PlayerSummary>(
    "PATCH",
    `${gamePath(gameId)}/players/${seg(playerId)}`,
    { status },
  );

/**
 * Generates the initial ring or runs a shakeup. Pass the round number the
 * admin saw (null when there is no round yet) so concurrent runs fail with
 * STALE_ROUND.
 */
export const shuffleRing = (
  gameId: string,
  expectedCurrentRoundNo: number | null,
) =>
  request<Ring>("POST", `${gamePath(gameId)}/rings`, {
    expectedCurrentRoundNo,
  });

/** The active ring in cycle order, or null before the first round (NO_RING). */
export const getCurrentRing = (gameId: string) =>
  nullOn("NO_RING", request<Ring>("GET", `${gamePath(gameId)}/rings/current`));

/** Rounds of the game, newest first. */
export const getRingHistory = (gameId: string) =>
  request<RoundSummary[]>("GET", `${gamePath(gameId)}/rings`);
