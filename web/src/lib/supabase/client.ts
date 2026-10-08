import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for Client Components. Auth only; never game data. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
