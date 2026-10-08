import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { returnPathFromConfirm } from "@/lib/login-next";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "email",
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email_change",
];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

/** Magic-link landing: exchanges token_hash for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = returnPathFromConfirm(searchParams);

  // On failure, keep the return path so a fresh login still lands there.
  const loginWithError = (error: string) =>
    `/login?error=${error}` +
    (next === "/" ? "" : `&next=${encodeURIComponent(next)}`);

  if (!tokenHash || !isEmailOtpType(type)) {
    redirect(loginWithError("invalid_link"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });
  if (error) {
    redirect(loginWithError("link_expired"));
  }

  redirect(next);
}
