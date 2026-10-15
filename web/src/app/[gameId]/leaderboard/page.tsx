import { redirect } from "next/navigation";

/** The leaderboard is a view of the game page now; keep old links working. */
export default async function LeaderboardRedirect(props: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const { gameId } = await props.params;
  const { round } = await props.searchParams;
  const qs = new URLSearchParams({ view: "leaderboard" });
  if (typeof round === "string") qs.set("round", round);
  redirect(`/${encodeURIComponent(gameId)}?${qs}`);
}
