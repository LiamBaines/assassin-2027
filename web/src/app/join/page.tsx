import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { Alert, Card, PlayerShell } from "@/components/ui";
import { getMe } from "@/lib/api";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join · Assassin 2027" };

export default async function JoinPage() {
  const me = await getMe();
  if (me.player) redirect("/me");

  const game = me.game;

  return (
    <PlayerShell title="Join the game" isAdmin={me.isAdmin}>
      <Card className="space-y-4">
        {game ? (
          <p className="text-sm text-zinc-600">
            Joining <span className="font-medium text-zinc-900">{game.name}</span>.
            Ask the organiser for the join code.
          </p>
        ) : (
          <Alert tone="info">
            There&apos;s no game running right now. Check back later.
          </Alert>
        )}
        {game && !game.signupsOpen && (
          <Alert tone="info">Signups for this game are closed.</Alert>
        )}
        <JoinForm />
      </Card>
      <div className="flex items-center justify-between text-sm text-zinc-600">
        <span>Signed in as {me.email}</span>
        <SignOutButton />
      </div>
    </PlayerShell>
  );
}
