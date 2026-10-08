"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { step: "email"; email?: string; error?: string }
  | { step: "code"; email: string; error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

async function requestCode(formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { step: "email", email, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/confirm`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    return {
      step: "email",
      email,
      error:
        error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "We couldn't send the email. Try again.",
    };
  }
  return { step: "code", email };
}

async function verifyCode(formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\s+/g, "");
  if (!EMAIL_RE.test(email)) {
    return { step: "email", error: "Enter your email again." };
  }
  if (!/^\d{6}$/.test(token)) {
    return { step: "code", email, error: "Enter the 6-digit code." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) {
    return { step: "code", email, error: "That code is wrong or has expired." };
  }
  redirect("/");
}

/** Two-step login: send a magic link + code, then verify the code. */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  switch (formData.get("intent")) {
    case "verify":
      return verifyCode(formData);
    case "restart":
      return { step: "email" };
    default:
      return requestCode(formData);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
