import { CheckCircle2, CircleDashed, MessageSquareQuote, Trash2, UserRound } from "lucide-react";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/action-form";
import {
  EmptyState,
  Panel,
  StatusChip,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  type StatusTone,
} from "@/components/ui";
import {
  getAdminPlayers,
  listKillWords,
  type KillWord,
  type KillWordState,
} from "@/lib/api";
import { addKillWordsAction, deleteKillWordAction } from "../../../actions";
import { loadAdminGame } from "../load-game";

const STATE_VIEW: Record<
  KillWordState,
  { label: string; tone: StatusTone; icon: typeof CircleDashed }
> = {
  UNUSED: { label: "Unused", tone: "neutral", icon: CircleDashed },
  ALLOCATED: { label: "Allocated", tone: "warn", icon: UserRound },
  USED: { label: "Used", tone: "dead", icon: CheckCircle2 },
};

export default async function AdminKillWordsPage(props: {
  params: Promise<{ gameId: string }>;
}) {
  const game = await loadAdminGame(props.params);
  const [words, players] = await Promise.all([
    listKillWords(game.id),
    getAdminPlayers(game.id),
  ]);
  const names = new Map(players.map((p) => [p.id, p.displayName]));
  const count = (s: KillWordState) => words.filter((w) => w.state === s).length;
  const editable = game.status !== "FINISHED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold">Kill words</h2>
        <p className="tabular text-sm text-muted">
          {count("UNUSED")} unused, {count("ALLOCATED")} allocated, {count("USED")} used
        </p>
      </div>

      {editable && (
        <Panel>
          <ActionForm
            action={addKillWordsAction.bind(null, game.id)}
            className="space-y-3"
          >
            <label htmlFor="kill-words-input" className="block text-sm font-medium">
              Add words
            </label>
            <textarea
              id="kill-words-input"
              name="words"
              rows={4}
              required
              placeholder="One word or phrase per line"
              data-testid="kill-words-input"
              className={inputClass}
            />
            <p className="text-sm text-muted">
              Words are unique within the game, ignoring case. A word given to a
              player stays burned and is never reused.
            </p>
            <SubmitButton pendingLabel="Adding…" className={primaryButtonClass}>
              Add words
            </SubmitButton>
          </ActionForm>
        </Panel>
      )}

      <Panel flush className="overflow-x-auto">
        {words.length === 0 ? (
          <div className="px-5">
            <EmptyState icon={MessageSquareQuote} title="No kill words yet">
              Add words above for the assassins to be given, or leave the list
              empty and use random words when you start a round.
            </EmptyState>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Word</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">Assassin</th>
                <th className="px-3 py-2 font-medium">Round</th>
                <th className="px-3 py-2 font-medium">Source</th>
                {editable && (
                  <th className="px-3 py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {words.map((w) => (
                <WordRow
                  key={w.id}
                  gameId={game.id}
                  word={w}
                  assassin={w.playerId ? names.get(w.playerId) : undefined}
                  editable={editable}
                />
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function WordRow({
  gameId,
  word,
  assassin,
  editable,
}: {
  gameId: string;
  word: KillWord;
  assassin: string | undefined;
  editable: boolean;
}) {
  const view = STATE_VIEW[word.state];
  return (
    <tr data-testid="kill-word-row" className="whitespace-nowrap">
      <td className="px-3 py-2 font-medium">{word.text}</td>
      <td className="px-3 py-2">
        <StatusChip tone={view.tone} icon={view.icon}>
          {view.label}
        </StatusChip>
      </td>
      <td className="px-3 py-2">
        {assassin ?? <span className="text-muted">—</span>}
      </td>
      <td className="tabular px-3 py-2">
        {word.roundNo ?? <span className="text-muted">—</span>}
      </td>
      <td className="px-3 py-2 text-muted">
        {word.origin === "RANDOM" ? "Random" : "Admin"}
      </td>
      {editable && (
        <td className="px-3 py-2 text-right">
          {word.state === "UNUSED" && (
            <ActionForm action={deleteKillWordAction.bind(null, gameId, word.id)}>
              <ConfirmSubmit
                label="Delete"
                confirmLabel="Delete"
                icon={<Trash2 aria-hidden className="size-4" />}
                iconOnly
                message={`Delete "${word.text}" from the list? It hasn't been given to anyone.`}
                confirmClassName={dangerButtonClass}
              />
            </ActionForm>
          )}
        </td>
      )}
    </tr>
  );
}
