import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { loadMe } from "@/lib/api";
import { safeNextPath } from "@/lib/safe-next";
import { setProfileAction } from "./actions";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Welcome · Assassin 2027" };

export default async function WelcomePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await props.searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : undefined);
  const me = await loadMe();
  if (me.profile) redirect(nextPath);

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="font-display text-4xl font-semibold">Pick your name</h1>
      <p className="mt-1 mb-8 text-muted">
        This is how other players will know you.
      </p>
      <WelcomeForm action={setProfileAction.bind(null, nextPath)} />
      <div className="mt-8 flex items-center justify-between text-sm text-muted">
        <span>{me.email}</span>
        <SignOutButton />
      </div>
    </main>
  );
}
