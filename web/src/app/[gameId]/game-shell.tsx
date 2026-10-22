"use client";

import { Crosshair, History, Inbox, Menu, ScrollText, Trophy, Users, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Sheet } from "@/components/overlay";
import { IconButton } from "@/components/ui";
import { INBOX_CHANGED_EVENT, UNREAD_POLL_MS, unreadBadge } from "@/lib/messages";
import { getUnreadCountAction } from "./actions";

export type GameView = "target" | "players" | "leaderboard" | "rounds" | "log" | "inbox";

const VIEW_META: Record<GameView, { label: string; icon: LucideIcon }> = {
  target: { label: "Target", icon: Crosshair },
  players: { label: "Players", icon: Users },
  leaderboard: { label: "Leaderboard", icon: Trophy },
  rounds: { label: "Past rounds", icon: History },
  log: { label: "Game log", icon: ScrollText },
  inbox: { label: "Inbox", icon: Inbox },
};

/** The bottom bar holds the frequent views; the rest live in the menu. */
const BAR_VIEWS: GameView[] = ["target", "players", "leaderboard", "log", "inbox"];

/**
 * Client chrome for the player game page. Each view's content is rendered on
 * the server and passed in, so switching views is instant and the URL's
 * `?view=` is kept in sync without a navigation.
 */
export function GameShell({
  gameId,
  initialUnread,
  gameName,
  playerName,
  roundNo,
  views,
  initialView,
  menuLinks,
  menuFooter,
}: {
  gameId: string;
  initialUnread: number;
  gameName: string;
  playerName: string;
  roundNo: number | null;
  views: Partial<Record<GameView, ReactNode>>;
  initialView: GameView;
  menuLinks: ReactNode;
  menuFooter: ReactNode;
}) {
  const [view, setView] = useState<GameView>(views[initialView] ? initialView : "target");
  const [menuOpen, setMenuOpen] = useState(false);

  const [unread, setUnread] = useState(initialUnread);
  const hasInbox = Boolean(views.inbox);

  const refreshUnread = useCallback(async () => {
    const n = await getUnreadCountAction(gameId);
    if (n !== null) setUnread(n);
  }, [gameId]);

  // Poll while the tab is visible, plus whenever the inbox reports a read or send.
  useEffect(() => {
    if (!hasInbox) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refreshUnread();
    };
    const id = window.setInterval(tick, UNREAD_POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener(INBOX_CHANGED_EVENT, tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener(INBOX_CHANGED_EVENT, tick);
    };
  }, [hasInbox, refreshUnread]);

  function show(next: GameView) {
    setView(next);
    setMenuOpen(false);
    const url = new URL(window.location.href);
    url.search = next === "target" ? "" : `?view=${next}`;
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
    if (hasInbox) void refreshUnread();
  }

  const barViews = BAR_VIEWS.filter((v) => views[v]);
  const menuViews = (Object.keys(VIEW_META) as GameView[]).filter(
    (v) => views[v] && !BAR_VIEWS.includes(v),
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-2xl leading-tight font-semibold">
            {gameName}
          </h1>
          <p className="truncate text-sm text-muted">
            <span data-testid="player-name">{playerName}</span>
            {roundNo !== null && (
              <>
                {" · "}
                <span data-testid="round-badge">Round {roundNo}</span>
              </>
            )}
          </p>
        </div>
        <IconButton icon={Menu} label="Menu" onClick={() => setMenuOpen(true)} />
      </header>

      <main className="flex-1 px-4 pt-4 pb-28">{views[view]}</main>

      {barViews.length > 1 && (
        <nav
          aria-label="Game views"
          className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-ink pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="mx-auto flex max-w-md">
            {barViews.map((v) => {
              const { label, icon: Icon } = VIEW_META[v];
              const current = v === view;
              const badge = v === "inbox" ? unreadBadge(unread) : null;
              return (
                <li key={v} className="flex-1">
                  <button
                    type="button"
                    onClick={() => show(v)}
                    aria-current={current ? "page" : undefined}
                    aria-label={badge?.label}
                    data-testid={`nav-${v}`}
                    className={`flex w-full flex-col items-center gap-1 py-2.5 text-xs ${
                      current ? "text-bone" : "text-muted hover:text-bone"
                    }`}
                  >
                    <span className="relative">
                      <Icon aria-hidden className="size-5" />
                      {badge?.text && (
                        <span
                          aria-hidden
                          data-testid="inbox-unread"
                          className="tabular absolute -top-1.5 left-3 min-w-4 rounded-full bg-blood px-1 text-center text-[10px] leading-4 font-medium text-bone"
                        >
                          {badge.text}
                        </span>
                      )}
                    </span>
                    {label}
                    <span
                      aria-hidden
                      className={`h-0.5 w-6 ${current ? "bg-blood" : "bg-transparent"}`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <div className="flex flex-col gap-1">
          {menuViews.map((v) => {
            const { label, icon: Icon } = VIEW_META[v];
            return (
              <button
                key={v}
                type="button"
                onClick={() => show(v)}
                className="flex items-center gap-3 rounded-control px-2 py-2.5 text-left hover:bg-raised"
              >
                <Icon aria-hidden className="size-5 text-muted" />
                {label}
              </button>
            );
          })}
          {menuLinks}
        </div>
        <div className="mt-4 border-t border-line pt-3">{menuFooter}</div>
      </Sheet>
    </div>
  );
}
