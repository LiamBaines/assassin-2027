import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { welcomePathWithNext } from "@/lib/login-next";
import { REQUEST_PATH_HEADER } from "@/lib/supabase/proxy";
import { createClient } from "@/lib/supabase/server";
import type {
  AdminClaim,
  AdminGame,
  AdminKill,
  AdminPlayer,
  AdminRound,
  ClaimAcceptResult,
  ClaimStatus,
  CreateGameRequest,
  JoinPreview,
  KillMethod,
  KillMethodInput,
  KillWord,
  GameEventPage,
  JoinRequest,
  Leaderboard,
  KillResult,
  Me,
  MyClaims,
  MyGame,
  MyRound,
  MyTarget,
  Profile,
  PlayerSummary,
  Roster,
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
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
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

const leaderboardQuery = (roundNo?: number) =>
  roundNo === undefined ? "" : `?roundNo=${roundNo}`;

// Player

/** The signed-in user, even one who hasn't set a name yet. Only /welcome should use this. */
export const loadMe = cache(() => request<Me>("GET", "/api/me"));

/**
 * The signed-in user. Deduplicated per request, so layouts and pages can both call it. Someone who hasn't set their
 * display name yet is sent to /welcome first, and back to where they were going afterwards.
 */
export const getMe = cache(async (): Promise<Me & { profile: Profile }> => {
  const me = await loadMe();
  if (!me.profile) {
    redirect(welcomePathWithNext((await headers()).get(REQUEST_PATH_HEADER) ?? "/"));
  }
  return me as Me & { profile: Profile };
});

/** Sets the caller's display name. It can only be set once (PROFILE_EXISTS). */
export const createProfile = (displayName: string) =>
  request<Profile>("PUT", "/api/me/profile", { displayName });

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

/** Every player's display name and status in a started game, or null when it hasn't started. */
export const getGamePlayers = (gameId: string) =>
  nullOn(
    "GAME_NOT_STARTED",
    request<Roster>("GET", `/api/me/games/${seg(gameId)}/players`),
  );

/** The game's closed rounds with the caller's outcome in each, newest first. */
export const getMyRounds = (gameId: string) =>
  request<MyRound[]>("GET", `/api/me/games/${seg(gameId)}/rounds`);

/** The game leaderboard as a player sees it; no roundNo means the game total. */
export const getMyLeaderboard = (gameId: string, roundNo?: number) =>
  request<Leaderboard>(
    "GET",
    `/api/me/games/${seg(gameId)}/leaderboard${leaderboardQuery(roundNo)}`,
  );

const eventsQuery = (before?: number) => (before === undefined ? "" : `?before=${before}`);

/** The game's event log as a player sees it, newest first. */
export const getMyEvents = (gameId: string, before?: number) =>
  request<GameEventPage>("GET", `/api/me/games/${seg(gameId)}/events${eventsQuery(before)}`);

const claimsPath = (gameId: string) =>
  `/api/me/games/${seg(gameId)}/kill-claims`;

/** Files a kill claim against the caller's current target. */
export const fileKillClaim = (gameId: string, killMethodId: number) =>
  request<ClaimStatus>("POST", claimsPath(gameId), { killMethodId });

/** The enabled kill methods a player can pick. */
export const getMyKillMethods = (gameId: string) =>
  request<KillMethod[]>("GET", `/api/me/games/${seg(gameId)}/kill-methods`);

export const withdrawKillClaim = (gameId: string, claimId: number) =>
  request<ClaimStatus>("POST", `${claimsPath(gameId)}/${claimId}/withdraw`);

/** Victim confirms the kill. */
export const acceptKillClaim = (gameId: string, claimId: number) =>
  request<ClaimAcceptResult>("POST", `${claimsPath(gameId)}/${claimId}/accept`);

export const contestKillClaim = (gameId: string, claimId: number) =>
  request<ClaimStatus>("POST", `${claimsPath(gameId)}/${claimId}/contest`);

/** The caller's outgoing claim and the pending claim against them, if any. */
export const getMyKillClaims = (gameId: string) =>
  request<MyClaims>("GET", `${claimsPath(gameId)}/mine`);

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

export const registerKill = (
  gameId: string,
  victimId: string,
  killMethodId: number,
) =>
  request<KillResult>("POST", `${gamePath(gameId)}/kills`, {
    victimId,
    killMethodId,
  });

/** Every kill method of the game, disabled ones included. */
export const getAdminKillMethods = (gameId: string) =>
  request<KillMethod[]>("GET", `${gamePath(gameId)}/kill-methods`);

/** The game's kills, newest first. */
export const listKills = (gameId: string) =>
  request<AdminKill[]>("GET", `${gamePath(gameId)}/kills`);

/** Corrects the method of a recorded kill; the API adjusts the killer's points. */
export const changeKillMethod = (
  gameId: string,
  killId: number,
  killMethodId: number,
) =>
  request<{ killId: number }>(
    "PATCH",
    `${gamePath(gameId)}/kills/${killId}`,
    { killMethodId },
  );

/**
 * Generates the initial ring or runs a shakeup. Pass the round number the
 * admin saw (null when there is no round yet) so concurrent runs fail with
 * STALE_ROUND. `killMethods` edits the game's methods when generating round 1.
 */
export const shuffleRing = (
  gameId: string,
  expectedCurrentRoundNo: number | null,
  killMethods?: KillMethodInput[],
  words?: Record<string, string>,
) =>
  request<Ring>("POST", `${gamePath(gameId)}/rings`, {
    expectedCurrentRoundNo,
    killMethods,
    words,
  });

/** Closes the open round and starts the next with the given players. */
export const startRound = (
  gameId: string,
  expectedRoundNo: number,
  playerIds: string[],
  killMethods?: KillMethodInput[],
  words?: Record<string, string>,
) =>
  request<Ring>("POST", `${gamePath(gameId)}/rounds`, {
    expectedRoundNo,
    playerIds,
    killMethods,
    words,
  });

/** The game's kill words: unused, allocated and used. */
export const listKillWords = (gameId: string) =>
  request<KillWord[]>("GET", `${gamePath(gameId)}/kill-words`);

/** Adds words to the list, all or nothing. */
export const addKillWords = (gameId: string, words: string[]) =>
  request<KillWord[]>("POST", `${gamePath(gameId)}/kill-words`, { words });

/** Deletes a word that hasn't been allocated. */
export const deleteKillWord = (gameId: string, wordId: number) =>
  request<void>("DELETE", `${gamePath(gameId)}/kill-words/${wordId}`);

/** Random words not yet in the game's list. Nothing is saved. */
export const getKillWordSuggestions = (gameId: string, count: number) =>
  request<string[]>(
    "GET",
    `${gamePath(gameId)}/kill-words/suggestions?count=${count}`,
  );

/** Game rounds, newest first. */
export const getAdminRounds = (gameId: string) =>
  request<AdminRound[]>("GET", `${gamePath(gameId)}/rounds`);

/** The active ring in cycle order, or null before the first round (NO_RING). */
export const getCurrentRing = (gameId: string) =>
  nullOn("NO_RING", request<Ring>("GET", `${gamePath(gameId)}/rings/current`));

/** Allocations (initial ring and shakeups) of the game, newest first. */
export const getRingHistory = (gameId: string) =>
  request<RoundSummary[]>("GET", `${gamePath(gameId)}/rings`);

export const getAdminLeaderboard = (gameId: string, roundNo?: number) =>
  request<Leaderboard>(
    "GET",
    `${gamePath(gameId)}/leaderboard${leaderboardQuery(roundNo)}`,
  );

export const getAdminEvents = (gameId: string, before?: number) =>
  request<GameEventPage>("GET", `${gamePath(gameId)}/events${eventsQuery(before)}`);

export const listOpenKillClaims = (gameId: string) =>
  request<AdminClaim[]>("GET", `${gamePath(gameId)}/kill-claims?status=open`);

export const confirmKillClaim = (gameId: string, claimId: number) =>
  request<KillResult>("POST", `${gamePath(gameId)}/kill-claims/${claimId}/confirm`);

export const dismissKillClaim = (gameId: string, claimId: number) =>
  request<ClaimStatus>("POST", `${gamePath(gameId)}/kill-claims/${claimId}/dismiss`);
