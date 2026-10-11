import { ArrowRight, Crosshair, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayerShell, Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { getMe } from "@/lib/api";

export default async function Home() {
  const me = await getMe();
  const playing = me.games.length > 0;
  const playerHref = playing ? "/me" : "/join";

  if (!me.isAdmin) redirect(playerHref);

  // Admins may also play, so give them a choice instead of redirecting.
  return (
    <PlayerShell title="Assassin 2027">
      <Panel className="space-y-4">
        <p className="text-sm text-muted">Signed in as {me.email}</p>
        <div className="flex flex-col gap-2">
          <Link href="/admin" className={primaryButtonClass}>
            <ShieldCheck aria-hidden className="size-4" />
            Admin console
          </Link>
          <Link href={playerHref} className={secondaryButtonClass}>
            <Crosshair aria-hidden className="size-4" />
            {playing ? "My games" : "Join a game"}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </Panel>
    </PlayerShell>
  );
}
