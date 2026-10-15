import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/api";
import { LAST_AREA_COOKIE, LAST_GAME_COOKIE, resolveHome } from "@/lib/last-view";

export default async function Home() {
  const [me, jar] = await Promise.all([getMe(), cookies()]);
  redirect(
    resolveHome({
      isAdmin: me.isAdmin,
      gameIds: me.games.map((g) => g.game.id),
      lastArea: jar.get(LAST_AREA_COOKIE)?.value,
      lastGame: jar.get(LAST_GAME_COOKIE)?.value,
    }),
  );
}
