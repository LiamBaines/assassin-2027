import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, PlayerShell } from "@/components/ui";
import { getMe, type Me } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Me · Assassin 2027" };

function statusView(me: Me): { label: string; tone: string; hint?: string } {
  const player = me.player!;
  switch (player.status) {
    case "REMOVED":
      return {
        label: "Removed",
        tone: "bg-zinc-200 text-zinc-800",
        hint: "The organiser has removed you from the game.",
      };
    case "DEAD":
      return { label: "Dead", tone: "bg-red-100 text-red-800" };
    case "ALIVE":
      if (!me.game || me.game.status === "SETUP") {
        return {
          label: "Registered — waiting for the game to start",
          tone: "bg-amber-100 text-amber-900",
        };
      }
      return {
        label: "Alive",
        tone: "bg-emerald-100 text-emerald-800",
        hint: me.game.status === "FINISHED" ? "The game has finished." : undefined,
      };
  }
}

export default async function MePage() {
  const me = await getMe();
  if (!me.player) redirect("/join");

  const status = statusView(me);

  return (
    <PlayerShell title={me.player.displayName} isAdmin={me.isAdmin}>
      <Card className="space-y-3">
        {me.game && <p className="text-sm text-zinc-500">{me.game.name}</p>}
        <p
          data-testid="player-status"
          className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${status.tone}`}
        >
          {status.label}
        </p>
        {status.hint && <p className="text-sm text-zinc-600">{status.hint}</p>}
        <p className="text-xs text-zinc-500">
          Joined {formatDateTime(me.player.joinedAt)}
        </p>
      </Card>
      <Link
        href="/target"
        className="block rounded-lg bg-zinc-900 px-4 py-3 text-center font-medium text-white"
      >
        See my target
      </Link>
      <div className="flex items-center justify-between text-sm text-zinc-600">
        <span>{me.email}</span>
        <SignOutButton />
      </div>
    </PlayerShell>
  );
}
