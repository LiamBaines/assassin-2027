import { safeNextPath } from "@/lib/safe-next";

/**
 * The login URL for an unauthenticated visit to `pathname` + `search`, keeping
 * the original location as `?next=` so the user returns there after logging in.
 * The home page needs no `next`, since "/" is the default.
 */
export function loginPathWithNext(pathname: string, search: string): string {
  const next = safeNextPath(pathname + search);
  return next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}

/** Where the magic link lands: `/auth/confirm`, carrying `next` unless it is "/". */
export function confirmRedirectUrl(siteUrl: string, next: string): string {
  const base = `${siteUrl.replace(/\/+$/, "")}/auth/confirm`;
  const safe = safeNextPath(next);
  return safe === "/" ? base : `${base}?next=${encodeURIComponent(safe)}`;
}

/**
 * The return path for the magic-link landing. The email template passes
 * Supabase's `{{ .RedirectTo }}` (our `emailRedirectTo`) as `redirect_to`, so
 * the `next` inside it wins; a plain `next` parameter is the fallback.
 */
export function returnPathFromConfirm(params: URLSearchParams): string {
  const redirectTo = params.get("redirect_to");
  if (redirectTo) {
    try {
      const inner = new URL(redirectTo, "http://localhost").searchParams.get("next");
      if (inner) return safeNextPath(inner);
    } catch {
      // Malformed: fall through to `next`.
    }
  }
  return safeNextPath(params.get("next"));
}
