"use client";

import { ArrowLeft, ChevronRight, Inbox as InboxIcon, Send, Swords } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  getMessagesAction,
  markMessagesReadAction,
  sendMessageAction,
} from "@/app/[gameId]/actions";
import { ChallengeDialog, DuelCard } from "@/components/duel-card";
import {
  Alert,
  EmptyState,
  IconButton,
  inputClass,
} from "@/components/ui";
import { HiddenName } from "@/components/target-reveal";
import { myOpenChallenge, revealedAssassinName } from "@/lib/duel";
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

/** The length counter appears once the message is this close to the limit. */
const COUNTER_FROM = Math.floor(MESSAGE_MAX_LENGTH * 0.8);

function notifyChanged() {
  window.dispatchEvent(new Event(INBOX_CHANGED_EVENT));
}

/** The counterpart's name when known: your target's always, your assassin's only once a duel you accepted revealed it. */
function knownName(
  role: MessageCounterpart,
  targetName: string | null,
  assassinName: string | null,
): string | null {
  return role === "TARGET" ? targetName : role === "ASSASSIN" ? assassinName : null;
}

/** Two fixed conversations ("Your target", "Your assassin"), each live only while its assignment is. */
export function Inbox({
  gameId,
  threads: initialThreads,
  failed,
  targetName,
  duelAvailable,
}: {
  gameId: string;
  threads: MessageThread[];
  /** The threads could not be loaded. */
  failed: boolean;
  targetName: string | null;
  /** An enabled "Duel" kill method exists. */
  duelAvailable: boolean;
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
        name={knownName(open, targetName, revealedAssassinName(openThread.messages))}
        targetName={targetName}
        duelAvailable={duelAvailable}
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
                      <span className="block truncate font-medium">{threadTitle(role)}</span>
                      <span className="block truncate text-sm text-muted">
                        {last
                          ? `${last.mine ? "You: " : ""}${last.kind === "DUEL" ? "Duel challenge: " : ""}${last.body}`
                          : "No messages yet"}
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
  name,
  targetName,
  duelAvailable,
  onBack,
}: {
  gameId: string;
  thread: MessageThread;
  name: string | null;
  targetName: string | null;
  duelAvailable: boolean;
  onBack: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [challenging, setChallenging] = useState(false);
  const role = thread.with;
  const canChallenge = role === "TARGET" && duelAvailable && !myOpenChallenge(thread.messages);
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
        <h2 className="flex min-w-0 items-center gap-2 font-display text-xl font-semibold">
          <span className="shrink-0">{threadTitle(role)}</span>
          {name && (
            <HiddenName name={name} label={`Hold to show ${threadTitle(role).toLowerCase()}`} testId="duel-reveal" />
          )}
        </h2>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto border-t border-line py-3">
        {count === 0 ? (
          role === "ADMIN" ? (
            <p className="text-sm text-muted">No messages from the admin yet.</p>
          ) : (
          <p className="text-sm text-muted">
            No messages yet. They won&apos;t see your name, only that it&apos;s from{" "}
            {role === "TARGET" ? "their assassin" : "their target"}.
          </p>
          )
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
                {cluster.map((m) =>
                  m.kind === "DUEL" && m.duel ? (
                    <DuelCard key={m.id} gameId={gameId} duel={m.duel} onChanged={notifyChanged} />
                  ) : m.kind === "SYSTEM" ? (
                    <p key={m.id} data-testid="system-message" className="self-center text-sm text-muted">
                      {m.body}
                    </p>
                  ) : (
                  <p
                    key={m.id}
                    data-testid="message"
                    className={`max-w-[85%] rounded-panel border border-line px-3 py-2 break-words whitespace-pre-wrap ${
                      m.mine ? "self-end bg-raised" : "self-start"
                    }`}
                  >
                    {m.body}
                  </p>
                  ),
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {role === "ADMIN" ? (
        <p className="shrink-0 border-t border-line pt-3 text-sm text-muted">
          You can&apos;t reply to the admin. Messages here are notices about your game.
        </p>
      ) : (
      <form onSubmit={send} className="shrink-0 space-y-2 border-t border-line pt-3">
        <div className="flex items-end gap-2">
          {canChallenge && (
            <IconButton
              icon={Swords}
              label="Challenge to a duel"
              data-testid="duel-challenge"
              onClick={() => setChallenging(true)}
              className="size-9 shrink-0 border border-line"
            />
          )}
          <label htmlFor="message-body" className="sr-only">
            Message to {threadTitle(role).toLowerCase()}
          </label>
          <textarea
            id="message-body"
            data-testid="message-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={1}
            maxLength={MESSAGE_MAX_LENGTH + 20}
            placeholder="Write a message"
            className={`${inputClass} min-w-0 flex-1 resize-none`}
          />
          {(pending || isValidBody(body)) && (
            <button
              type="submit"
              data-testid="message-send"
              aria-label="Send message"
              title="Send message"
              disabled={pending}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-blood text-bone hover:bg-blood-hover disabled:opacity-60"
            >
              <Send aria-hidden className="size-4" />
            </button>
          )}
        </div>
        {body.trim().length >= COUNTER_FROM && (
          <p
            className={`tabular text-right text-sm ${body.trim().length > MESSAGE_MAX_LENGTH ? "text-blood" : "text-muted"}`}
          >
            {body.trim().length}/{MESSAGE_MAX_LENGTH}
          </p>
        )}
        {error && <Alert>{error}</Alert>}
      </form>
      )}
      <ChallengeDialog
        gameId={gameId}
        targetName={targetName}
        open={challenging}
        onClose={() => setChallenging(false)}
        onSent={notifyChanged}
      />
    </section>
  );
}
