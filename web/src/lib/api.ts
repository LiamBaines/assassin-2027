import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  AdminGame,
  AdminPlayer,
  CreateGameRequest,
  JoinRequest,
  Me,
  MePlayer,
  MyTarget,
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

/** Resolves to null on a 404, rethrows anything else. */
async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

// Player

export const getMe = () => request<Me>("GET", "/api/me");

export const joinGame = (req: JoinRequest) =>
  request<MePlayer>("POST", "/api/players", req);

/** The caller's current target, or null when they have none (NO_TARGET). */
export const getMyTarget = () =>
  orNull(request<MyTarget>("GET", "/api/me/target"));

// Admin

/** The live game, or null when there is none. */
export const getAdminGame = () =>
  orNull(request<AdminGame>("GET", "/api/admin/game"));

export const createGame = (req: CreateGameRequest) =>
  request<AdminGame>("POST", "/api/admin/game", req);

export const updateGame = (req: UpdateGameRequest) =>
  request<AdminGame>("PATCH", "/api/admin/game", req);

export const getAdminPlayers = () =>
  request<AdminPlayer[]>("GET", "/api/admin/players");

export const setPlayerStatus = (id: string, status: "ALIVE" | "REMOVED") =>
  request<AdminPlayer>(
    "PATCH",
    `/api/admin/players/${encodeURIComponent(id)}`,
    { status },
  );

/**
 * Generates the initial ring or runs a shakeup. Pass the round number the
 * admin saw (0 when there is no round yet) so concurrent runs fail with
 * STALE_ROUND.
 */
export const shuffleRing = (expectedCurrentRoundNo: number | null) =>
  request<Ring>("POST", "/api/admin/rings", { expectedCurrentRoundNo });

/** The active ring in cycle order, or null before the first round. */
export const getCurrentRing = () =>
  orNull(request<Ring>("GET", "/api/admin/rings/current"));

export const getRingHistory = () =>
  request<RoundSummary[]>("GET", "/api/admin/rings");
