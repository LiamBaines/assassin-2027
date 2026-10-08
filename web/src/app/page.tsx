import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PlayerShell } from "@/components/ui";
import { getMe } from "@/lib/api";

export default async function Home() {
  const me = await getMe();
  const playerHref = me.player ? "/me" : "/join";

  if (!me.isAdmin) redirect(playerHref);

  // Admins may also play, so give them a choice instead of redirecting.
  return (
    <PlayerShell title="Assassin 2027">
      <Card className="space-y-3">
        <p className="text-sm text-zinc-600">Signed in as {me.email}</p>
        <Link
          href="/admin"
          className="block rounded-lg bg-zinc-900 px-4 py-2.5 text-center font-medium text-white"
        >
          Admin console
        </Link>
        <Link
          href={playerHref}
          className="block rounded-lg border border-zinc-300 px-4 py-2.5 text-center font-medium"
        >
          {me.player ? "My player page" : "Join the game"}
        </Link>
      </Card>
    </PlayerShell>
  );
}
