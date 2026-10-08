import path from "node:path";
import { createClient } from "@supabase/supabase-js";

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run the specs through scripts/e2e.sh.`);
  return value;
}

export const JOIN_CODE = "TEST42";

export type E2eUser = { key: string; email: string; displayName?: string };

export const ADMIN: E2eUser = { key: "admin", email: "admin@e2e.test" };

export const PLAYERS = [
  { key: "player1", email: "player1@e2e.test", displayName: "Alice E2E" },
  { key: "player2", email: "player2@e2e.test", displayName: "Bob E2E" },
  { key: "player3", email: "player3@e2e.test", displayName: "Carol E2E" },
] as const satisfies readonly E2eUser[];

export const ALL_USERS: readonly E2eUser[] = [ADMIN, ...PLAYERS];

/** Saved storageState (session cookies) for a user, written by global setup. */
export function storageStatePath(user: E2eUser): string {
  return path.join(__dirname, ".auth", `${user.key}.json`);
}

/** Supabase admin client using the local secret key. e2e only. */
export function supabaseAdmin() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Mints a one-time login link for `email` without sending an email. The
 * returned path goes through the app's own /auth/confirm route, like the link
 * in the magic-link email does.
 */
export async function confirmPathFor(email: string): Promise<string> {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;
  const tokenHash = data.properties.hashed_token;
  // generateLink reports `signup` for new users and `magiclink` for existing
  // ones. verifyOtp's `email` type accepts both, and it is what the email
  // template links use.
  return `/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=email&next=/`;
}

/** A cycle check: every pair's target is the next pair's assassin, ending where it began. */
export function assertSingleCycle(pairs: { assassin: string; target: string }[]): void {
  const next = new Map(pairs.map((p) => [p.assassin, p.target]));
  if (next.size !== pairs.length) throw new Error("an assassin appears twice in the ring");
  const start = pairs[0].assassin;
  let current = start;
  for (let i = 0; i < pairs.length; i++) {
    const target = next.get(current);
    if (target === undefined) throw new Error(`${current} has no target in the ring`);
    if (target === current) throw new Error(`${current} targets themself`);
    current = target;
    if (current === start && i !== pairs.length - 1) {
      throw new Error(`the ring closes after ${i + 1} of ${pairs.length} pairs`);
    }
  }
  if (current !== start) throw new Error("the ring does not close into a cycle");
}
