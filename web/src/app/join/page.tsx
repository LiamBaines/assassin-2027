import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { Panel, PlayerShell } from "@/components/ui";
import { getMe } from "@/lib/api";
import { JoinCodeForm } from "./join-code-form";

export const metadata: Metadata = { title: "Join · Assassin 2027" };

export default async function JoinPage() {
  const me = await getMe();

  return (
    <PlayerShell title="Join a game" isAdmin={me.isAdmin}>
      <Panel className="space-y-4">
        <p className="text-sm text-muted">
          Enter the join code from the organiser, or open the join link they
          shared.
        </p>
        <JoinCodeForm />
      </Panel>
      {me.games.length > 0 && (
        <Link href="/me" className="inline-flex items-center gap-2 text-sm text-muted hover:text-bone">
          <ArrowLeft aria-hidden className="size-4" />
          Back to my games
        </Link>
      )}
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Signed in as {me.email}</span>
        <SignOutButton />
      </div>
    </PlayerShell>
  );
}
