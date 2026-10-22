"use client";

import { ArrowLeft, ChevronRight, Inbox as InboxIcon, Send } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  markMessagesReadAction,
  sendMessageAction,
} from "@/app/[gameId]/actions";
import { Alert, EmptyState, IconButton, RelativeTime, inputClass, primaryButtonClass } from "@/components/ui";
import type { MessageCounterpart, MessageThread } from "@/lib/api-types";
import {
  INBOX_CHANGED_EVENT,
  MESSAGE_MAX_LENGTH,
  isValidBody,
  threadTitle,
} from "@/lib/messages";

const ROLES: MessageCounterpart[] = ["TARGET", "ASSASSIN"];

function notifyChanged() {
  window.dispatchEvent(new Event(INBOX_CHANGED_EVENT));
}

/** Two fixed conversations ("Your target", "Your assassin"), each live only while its assignment is. */
export function Inbox({
  gameId,
  threads,
  failed,
}: {
  gameId: string;
  threads: MessageThread[];
  /** The threads could not be loaded. */
  failed: boolean;
}) {
  const [open, setOpen] = useState<MessageCounterpart | null>(null);
  const byRole = new Map(threads.map((t) => [t.with, t]));
  const openThread = open ? byRole.get(open) : undefined;

  if (failed) {
    return (
      <section data-testid="inbox">
        <h2 className="mb-3 font-display text-xl font-semibold">Inbox</h2>
        <Alert>Couldn&apos;t load your messages. Reload the page to try again.</Alert>
      </section>
    );
  }

  if (open && openThread) {
    return <ThreadView gameId={gameId} thread={openThread} onBack={() => setOpen(null)} />;
  }

  return (
    <section data-testid="inbox">
      <h2 className="mb-3 font-display text-xl font-semibold">Inbox</h2>
      {threads.length === 0 && (
        <EmptyState icon={InboxIcon} title="No conversations">
          You can message your target and your assassin, without revealing who you are, once you
          have a target in an active game.
        </EmptyState>
      )}
      {threads.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {ROLES.map((role) => {
            const t = byRole.get(role);
            if (!t) return null;
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
                    <span className="block font-medium">{threadTitle(role)}</span>
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
    </section>
  );
}

function ThreadView({
  gameId,
  thread,
  onBack,
}: {
  gameId: string;
  thread: MessageThread;
  onBack: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const role = thread.with;
  const unread = thread.unread;

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
    <section data-testid="inbox-thread" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <IconButton icon={ArrowLeft} label="Back to inbox" onClick={onBack} />
        <h2 className="font-display text-xl font-semibold">{threadTitle(role)}</h2>
      </div>

      {thread.messages.length === 0 ? (
        <p className="text-sm text-muted">
          No messages yet. They won&apos;t see your name, only that it&apos;s from{" "}
          {role === "TARGET" ? "your assassin" : "their target"}.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {thread.messages.map((m) => (
            <li
              key={m.id}
              data-testid="message"
              className={`flex max-w-[85%] flex-col gap-0.5 rounded-panel border px-3 py-2 ${
                m.mine ? "self-end border-line bg-raised" : "self-start border-line"
              }`}
            >
              <span className="text-xs text-muted">{m.mine ? "You" : threadTitle(role)}</span>
              <span className="break-words whitespace-pre-wrap">{m.body}</span>
              <RelativeTime iso={m.createdAt} className="text-xs text-muted" />
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={send} className="space-y-2 border-t border-line pt-4">
        <label htmlFor="message-body" className="sr-only">
          Message to {threadTitle(role).toLowerCase()}
        </label>
        <textarea
          id="message-body"
          data-testid="message-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={MESSAGE_MAX_LENGTH + 20}
          placeholder="Write a message"
          className={inputClass}
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
