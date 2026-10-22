import { CircleDashed, CheckCircle2, MessagesSquare, Trash2 } from "lucide-react";
import { ActionForm, ConfirmSubmit } from "@/components/action-form";
import {
  EmptyState,
  Panel,
  StatusChip,
  dangerButtonClass,
  type StatusTone,
} from "@/components/ui";
import { listAdminMessages, type AdminMessage, type AssignmentStatus } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { deleteMessageAction } from "../../../actions";
import { loadAdminGame } from "../load-game";

const THREAD_VIEW: Record<
  AssignmentStatus,
  { label: string; tone: StatusTone; icon: typeof CircleDashed }
> = {
  ACTIVE: { label: "Live", tone: "alive", icon: CheckCircle2 },
  COMPLETED: { label: "Ended by kill", tone: "neutral", icon: CircleDashed },
  SUPERSEDED: { label: "Ended by shakeup", tone: "neutral", icon: CircleDashed },
  VOIDED: { label: "Ended", tone: "neutral", icon: CircleDashed },
};

export default async function AdminMessagesPage(props: {
  params: Promise<{ gameId: string }>;
}) {
  const game = await loadAdminGame(props.params);
  const messages = await listAdminMessages(game.id).catch(() => null);

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold">Messages</h2>
      <Panel flush className="overflow-x-auto">
        {messages === null ? (
          <div className="px-5">
            <EmptyState icon={MessagesSquare} title="Couldn't load the messages">
              Something went wrong fetching messages. Refresh the page to try again.
            </EmptyState>
          </div>
        ) : messages.length === 0 ? (
          <div className="px-5">
            <EmptyState icon={MessagesSquare} title="No messages yet">
              Anonymous messages between assassins and their targets show up here
              with real names.
            </EmptyState>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Sent</th>
                <th className="px-3 py-2 font-medium">From</th>
                <th className="px-3 py-2 font-medium">To</th>
                <th className="px-3 py-2 font-medium">Message</th>
                <th className="px-3 py-2 font-medium">Thread</th>
                <th className="px-3 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {messages.map((m) => (
                <MessageRow key={m.id} gameId={game.id} message={m} />
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function MessageRow({ gameId, message: m }: { gameId: string; message: AdminMessage }) {
  const view = THREAD_VIEW[m.assignmentStatus];
  return (
    <tr data-testid="admin-message-row">
      <td className="tabular px-3 py-2 whitespace-nowrap text-muted">
        {formatDateTime(m.createdAt)}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">{m.senderName}</td>
      <td className="px-3 py-2 whitespace-nowrap">{m.recipientName}</td>
      <td className="max-w-md px-3 py-2 break-words">{m.body}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        <StatusChip tone={view.tone} icon={view.icon}>
          {view.label}
        </StatusChip>
      </td>
      <td className="px-3 py-2 text-right">
        <ActionForm action={deleteMessageAction.bind(null, gameId, m.id)}>
          <ConfirmSubmit
            label="Delete"
            confirmLabel="Delete"
            icon={<Trash2 aria-hidden className="size-4" />}
            iconOnly
            message={`Delete this message from ${m.senderName}? It disappears for the players too.`}
            confirmClassName={dangerButtonClass}
          />
        </ActionForm>
      </td>
    </tr>
  );
}
