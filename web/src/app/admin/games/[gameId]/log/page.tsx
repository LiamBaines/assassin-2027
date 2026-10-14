import { EventLog } from "@/components/event-log";
import { getAdminEvents } from "@/lib/api";
import { loadAdminGame } from "../load-game";

export default async function AdminLogPage(props: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ before?: string | string[] }>;
}) {
  const game = await loadAdminGame(props.params);
  const raw = (await props.searchParams).before;
  const before = typeof raw === "string" ? Number(raw) : NaN;
  const page = await getAdminEvents(
    game.id,
    Number.isSafeInteger(before) && before > 0 ? before : undefined,
  ).catch(() => null);

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold">Log</h2>
      <EventLog page={page} moreHref={(b) => `?before=${b}`} />
    </div>
  );
}
