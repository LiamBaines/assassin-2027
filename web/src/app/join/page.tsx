import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, PlayerShell } from "@/components/ui";
import { getMe } from "@/lib/api";
import { JoinCodeForm } from "./join-code-form";

export const metadata: Metadata = { title: "Join · Assassin 2027" };

export default async function JoinPage() {
  const me = await getMe();

  return (
    <PlayerShell title="Join a game" isAdmin={me.isAdmin}>
      <Card className="space-y-4">
        <p className="text-sm text-zinc-600">
          Enter the join code from the organiser, or open the join link they
          shared.
        </p>
        <JoinCodeForm />
      </Card>
      {me.games.length > 0 && (
        <Link href="/me" className="block text-center text-sm text-zinc-600 underline">
          Back to my games
        </Link>
      )}
      <div className="flex items-center justify-between text-sm text-zinc-600">
        <span>Signed in as {me.email}</span>
        <SignOutButton />
      </div>
    </PlayerShell>
  );
}
