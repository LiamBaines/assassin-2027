import type { Metadata } from "next";
import { safeNextPath } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · Assassin 2027" };

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: "That login link is invalid. Request a new one.",
  link_expired: "That login link has expired or was already used. Request a new one.",
};

export default async function LoginPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error, next } = await props.searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : undefined);
  const code = typeof error === "string" ? error : undefined;
  const initialError = code
    ? (ERROR_MESSAGES[code] ?? "Something went wrong. Try again.")
    : undefined;

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="text-2xl font-semibold">Assassin 2027</h1>
      <p className="mt-1 mb-8 text-zinc-600">Log in with your email.</p>
      <LoginForm initialError={initialError} next={nextPath} />
    </main>
  );
}
