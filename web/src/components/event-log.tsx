import {
  Crosshair,
  Dices,
  Flag,
  Gift,
  ScrollText,
  Shuffle,
  UserMinus,
  UserPlus,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { EmptyState, secondaryButtonClass } from "@/components/ui";
import type { GameEventPage } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { describeEvent, type EventKind } from "@/lib/game-event";

const ICONS: Record<EventKind, LucideIcon> = {
  kill: Crosshair,
  removed: UserMinus,
  restored: UserRoundCheck,
  round: Flag,
  shakeup: Shuffle,
  joined: UserPlus,
  bonus: Gift,
  other: Dices,
};

/**
 * Most-recent-first game log. `page` is null when it failed to load.
 * `moreHref` builds the link to the next page from its `before` cursor.
 */
export function EventLog({
  page,
  moreHref,
}: {
  page: GameEventPage | null;
  moreHref: (before: number) => string;
}) {
  if (!page) {
    return (
      <EmptyState icon={ScrollText} title="Couldn't load the game log">
        Something went wrong fetching events. Refresh the page to try again.
      </EmptyState>
    );
  }
  if (page.events.length === 0) {
    return (
      <EmptyState icon={ScrollText} title="Nothing has happened yet">
        Kills, removals, new rounds and new players show up here as they happen.
      </EmptyState>
    );
  }
  return (
    <div data-testid="event-log" className="space-y-4">
      <ul className="divide-y divide-line border-y border-line">
        {page.events.map((e) => {
          const { kind, text } = describeEvent(e);
          const Icon = ICONS[kind];
          return (
            <li key={e.id} data-testid="event-item" className="flex items-start gap-3 py-3">
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <div className="min-w-0">
                <p className="break-words">{text}</p>
                <p className="text-sm text-muted">{formatDateTime(e.createdAt)}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {page.nextBefore !== null && (
        <Link href={moreHref(page.nextBefore)} className={secondaryButtonClass}>
          Load more
        </Link>
      )}
    </div>
  );
}
