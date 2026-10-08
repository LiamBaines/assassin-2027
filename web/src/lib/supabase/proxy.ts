import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { loginPathWithNext } from "@/lib/login-next";

/** Paths reachable without a session. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/")
  );
}

/**
 * Refreshes the Supabase session cookies on every matched request and
 * redirects unauthenticated users on protected routes to /login?next=<path>.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          cacheHeaders = { ...cacheHeaders, ...headers };
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): the call
  // refreshes an expired session and must happen before the response is built.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims && !isPublicPath(request.nextUrl.pathname)) {
    // Keep where the user was going, so a shared join link survives login.
    const url = new URL(
      loginPathWithNext(request.nextUrl.pathname, request.nextUrl.search),
      request.url,
    );
    const redirect = NextResponse.redirect(url);
    // Carry over any cookie changes (for example a cleared, expired session).
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    Object.entries(cacheHeaders).forEach(([key, value]) =>
      redirect.headers.set(key, value),
    );
    return redirect;
  }

  return response;
}
