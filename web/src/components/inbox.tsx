"use client";

import { ArrowLeft, ChevronRight, Inbox as InboxIcon, Send } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  getMessagesAction,
  markMessagesReadAction,
  sendMessageAction,
} from "@/app/[gameId]/actions";
import { Alert, EmptyState, IconButton, inputClass, primaryButtonClass } from "@/components/ui";
import type { MessageCounterpart, MessageThread } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import {
  INBOX_CHANGED_EVENT,
  MESSAGE_MAX_LENGTH,
  UNREAD_POLL_MS,
  clusterMessages,
  isValidBody,
  sortThreads,
  threadTitle,
} from "@/lib/messages";

function notifyChanged() {
  window.dispatchEvent(new Event(INBOX_CHANGED_EVENT));
}

/** Your target's name isn't secret from you, so it follows the title; your assassin stays unnamed. */
function titleFor(role: MessageCounterpart, targetName: string | null): string {
  return role === "TARGET" && targetName ? `${threadTitle(role)} · ${targetName}` : threadTitle(role);
}

/** Two fixed conversations ("Your target", "Your assassin"), each live only while its assignment is. */
export function Inbox({
  gameId,
  threads: initialThreads,
  failed,
  targetName,
}: {
  gameId: string;
  threads: MessageThread[];
  /** The threads could not be loaded. */
  failed: boolean;
  targetName: string | null;
}) {
  const [open, setOpen] = useState<MessageCounterpart | null>(null);
  // Polled threads replace the server-rendered ones until the page hands down new ones.
  const [polled, setPolled] = useState<MessageThread[] | null>(null);
  const [seenProp, setSeenProp] = useState(initialThreads);
  if (seenProp !== initialThreads) {
    setSeenProp(initialThreads);
    setPolled(null);
  }
  const threads = polled ?? initialThreads;

  // Refresh while the tab is visible, plus whenever the player reads or sends.
  useEffect(() => {
    if (failed) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void getMessagesAction(gameId).then((next) => {
        if (next) setPolled(next);
      });
    };
    const id = window.setInterval(tick, UNREAD_POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener(INBOX_CHANGED_EVENT, tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener(INBOX_CHANGED_EVENT, tick);
    };
  }, [gameId, failed]);

  const openThread = open ? threads.find((t) => t.with === open) : undefined;

  if (failed) {
    return (
      <section data-testid="inbox">
        <h2 className="mb-3 font-display text-xl font-semibold">Inbox</h2>
        <Alert>Couldn&apos;t load your messages. Reload the page to try again.</Alert>
      </section>
    );
  }

  if (open && openThread) {
    return (
      <ThreadView
        gameId={gameId}
        thread={openThread}
        title={titleFor(open, targetName)}
        onBack={() => setOpen(null)}
      />
    );
  }

  return (
    <section data-testid="inbox" className="flex min-h-0 flex-1 flex-col">
      <h2 className="mb-3 font-display text-xl font-semibold">Inbox</h2>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.length === 0 && (
          <EmptyState icon={InboxIcon} title="No conversations">
            You can message your target and your assassin, without revealing who you are, once you
            have a target in an active game.
          </EmptyState>
        )}
        {threads.length > 0 && (
          <ul className="divide-y divide-line border-y border-line">
            {sortThreads(threads).map((t) => {
              const role = t.with;
              const last = t.messages[t.messages.length - 1];
              return (
                <li key={role}>
                  <button
                    type="button"
                    data-testid={`inbox-thread-${role.toLowerCase()}`}
                    onClick={() => setOpen(role)}
                    className="flex w-full items-center gap-3 py-3 text-left hover:bg-raised"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{titleFor(role, targetName)}</span>
                      <span className="block truncate text-sm text-muted">
                        {last ? `${last.mine ? "You: " : ""}${last.body}` : "No messages yet"}
                      </span>
                    </span>
                    {t.unread > 0 && (
                      <span
                        data-testid="thread-unread"
                        className="tabular rounded-control border border-blood px-1.5 text-sm"
                      >
                        {t.unread} unread
                      </span>
                    )}
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function ThreadView({
  gameId,
  thread,
  title,
  onBack,
}: {
  gameId: string;
  thread: MessageThread;
  title: string;
  onBack: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const role = thread.with;
  const unread = thread.unread;
  const scroller = useRef<HTMLDivElement>(null);
  const count = thread.messages.length;

  // Newest message in view on open and whenever one arrives.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  // Opening the thread marks the other side's messages read.
  useEffect(() => {
    if (unread === 0) return;
    void markMessagesReadAction(gameId, role).then(notifyChanged);
  }, [gameId, role, unread]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidBody(body)) return;
    start(async () => {
      const result = await sendMessageAction(gameId, role, body.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setBody("");
      notifyChanged();
    });
  }

  return (
    <section data-testid="inbox-thread" className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 pb-2">
        <IconButton icon={ArrowLeft} label="Back to inbox" onClick={onBack} />
        <h2 className="min-w-0 truncate font-display text-xl font-semibold">{title}</h2>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto border-t border-line py-3">
        {count === 0 ? (
          <p className="text-sm text-muted">
            No messages yet. They won&apos;t see your name, only that it&apos;s from{" "}
            {role === "TARGET" ? "your assassin" : "their target"}.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {clusterMessages(thread.messages).map((cluster) => (
              <div key={cluster[0].id} className="flex flex-col gap-1">
                <time
                  dateTime={cluster[0].createdAt}
                  className="tabular mb-1 text-center text-xs text-muted"
                >
                  {formatDateTime(cluster[0].createdAt)}
                </time>
                {cluster.map((m) => (
                  <p
                    key={m.id}
                    data-testid="message"
                    className={`max-w-[85%] rounded-panel border border-line px-3 py-2 break-words whitespace-pre-wrap ${
                      m.mine ? "self-end bg-raised" : "self-start"
                    }`}
                  >
                    {m.body}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={send} className="shrink-0 space-y-2 border-t border-line pt-3">
        <label htmlFor="message-body" className="sr-only">
          Message to {threadTitle(role).toLowerCase()}
        </label>
        <textarea
          id="message-body"
          data-testid="message-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={MESSAGE_MAX_LENGTH + 20}
          placeholder="Write a message"
          className={`${inputClass} resize-none`}
        />
        <div className="flex items-center justify-between gap-3">
          <span
            className={`tabular text-sm ${body.trim().length > MESSAGE_MAX_LENGTH ? "text-blood" : "text-muted"}`}
          >
            {body.trim().length}/{MESSAGE_MAX_LENGTH}
          </span>
          <button
            type="submit"
            data-testid="message-send"
            disabled={pending || !isValidBody(body)}
            className={primaryButtonClass}
          >
            <Send aria-hidden className="size-4" />
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
        {error && <Alert>{error}</Alert>}
      </form>
    </section>
  );
}
