import {
  Crosshair,
  Dices,
  Flag,
  Gift,
  ScrollText,
  Save,
  Shuffle,
  UserMinus,
  UserPlus,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { KillMethodSelect } from "@/components/kill-method-select";
import { EmptyState, secondaryButtonClass } from "@/components/ui";
import type { ActionResult } from "@/components/action-form";
import type { GameEventPage, KillMethod } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { describeEvent, type EventAudience, type EventKind } from "@/lib/game-event";

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
  audience,
  moreHref,
  editKill,
}: {
  page: GameEventPage | null;
  audience: EventAudience;
  moreHref: (before: number) => string;
  /** Admin only: lets KILL events that carry a `killId` have their method changed in place. */
  editKill?: {
    methods: Pick<KillMethod, "id" | "name" | "points">[];
    action: (killId: number, prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  };
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
          const { kind, text } = describeEvent(e, audience);
          const Icon = ICONS[kind];
          const killId = typeof e.data.killId === "number" ? e.data.killId : null;
          const methodId = (e.data.method as { id?: unknown } | undefined)?.id;
          return (
            <li key={e.id} data-testid="event-item" className="flex items-start gap-3 py-3">
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <div className="min-w-0">
                <p className="break-words">{text}</p>
                <p className="text-sm text-muted">{formatDateTime(e.createdAt)}</p>
                {editKill && kind === "kill" && killId !== null && (
                  <ActionForm
                    action={editKill.action.bind(null, killId)}
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <KillMethodSelect
                      methods={editKill.methods}
                      defaultValue={typeof methodId === "number" ? methodId : undefined}
                    />
                    <SubmitButton icon={<Save aria-hidden className="size-4" />} iconOnly pendingLabel="Saving…">
                      Save method
                    </SubmitButton>
                  </ActionForm>
                )}
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
