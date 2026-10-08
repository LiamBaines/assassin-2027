import {
  ActionForm,
  ConfirmSubmit,
  SubmitButton,
} from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import {
  Card,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import type { AdminGame } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { joinLink } from "@/lib/join-code";
import {
  finishGameAction,
  setSignupsAction,
  updateGameAction,
} from "../../actions";
import { Field, GameFields } from "../../game-fields";
import { loadAdminGame } from "./load-game";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export default async function AdminGameDetailsPage(props: {
  params: Promise<{ gameId: string }>;
}) {
  const game = await loadAdminGame(props.params);
  const finished = game.status === "FINISHED";

  return (
    <div className="space-y-6">
      <Card>
        <dl className="grid gap-4 text-sm sm:grid-cols-5">
          <Field label="Join code">
            <span data-testid="join-code" className="font-mono">
              {game.joinCode}
            </span>
          </Field>
          <Field label="Players">{game.playerCount}</Field>
          <Field label="Created">{formatDateTime(game.createdAt)}</Field>
          <Field label="Started">{formatDateTime(game.startedAt)}</Field>
          <Field label="Finished">{formatDateTime(game.finishedAt)}</Field>
        </dl>
      </Card>

      {finished ? (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold">Read-only</h2>
          <p className="text-sm text-zinc-600">
            This game has finished, so it can&apos;t be changed. Signups were{" "}
            <strong data-testid="signups-state">
              {game.signupsOpen ? "open" : "closed"}
            </strong>{" "}
            when it ended.
          </p>
        </Card>
      ) : (
        <LiveGameControls game={game} />
      )}
    </div>
  );
}

function LiveGameControls({ game }: { game: AdminGame }) {
  const link = joinLink(siteUrl(), game.joinCode);
  return (
    <>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Join link</h2>
        <p className="text-sm text-zinc-600">
          Share this link. Players who open it only need to pick a display name.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            readOnly
            value={link}
            aria-label="Join link"
            data-testid="join-link"
            className={`${inputClass} max-w-xl flex-1 font-mono text-sm`}
          />
          <CopyButton text={link} label="Copy link" />
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Details</h2>
        <ActionForm action={updateGameAction.bind(null, game.id)} className="space-y-4">
          <GameFields game={game} />
          <SubmitButton className={primaryButtonClass}>Save changes</SubmitButton>
        </ActionForm>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Signups</h2>
        <p className="text-sm text-zinc-600">
          Signups are{" "}
          <strong data-testid="signups-state">
            {game.signupsOpen ? "open" : "closed"}
          </strong>
          . Late joiners get a target at the next shakeup.
        </p>
        <ActionForm
          action={setSignupsAction.bind(null, game.id)}
          className="flex flex-wrap gap-3"
        >
          <input
            type="hidden"
            name="signupsOpen"
            value={game.signupsOpen ? "false" : "true"}
          />
          <SubmitButton className={secondaryButtonClass}>
            {game.signupsOpen ? "Close signups" : "Open signups"}
          </SubmitButton>
        </ActionForm>
      </Card>

      <Card className="space-y-3 border-red-200">
        <h2 className="text-lg font-semibold">Finish the game</h2>
        <p className="text-sm text-zinc-600">
          Ends the game for everyone. This can&apos;t be undone.
        </p>
        <ActionForm
          action={finishGameAction.bind(null, game.id)}
          className="flex flex-wrap items-center gap-3"
        >
          <ConfirmSubmit
            label="Finish game"
            confirmLabel="Yes, finish it"
            message="Finish this game for everyone?"
            className={dangerButtonClass}
          />
        </ActionForm>
      </Card>
    </>
  );
}
