import type { ReactNode } from "react";
import {
  ActionForm,
  ConfirmSubmit,
  SubmitButton,
} from "@/components/action-form";
import {
  Card,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { getAdminGame, requireAdmin, type AdminGame } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  createGameAction,
  finishGameAction,
  setSignupsAction,
  updateGameAction,
} from "./actions";

export default async function AdminGamePage() {
  await requireAdmin();
  const game = await getAdminGame();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Game</h1>
      {game ? <GameSettings game={game} /> : <CreateGame />}
    </div>
  );
}

function GameFields({ game }: { game?: AdminGame }) {
  return (
    <div className="grid max-w-xl gap-4 sm:grid-cols-2">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          name="name"
          defaultValue={game?.name}
          required
          maxLength={100}
          className={inputClass}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Join code</span>
        <input
          name="joinCode"
          defaultValue={game?.joinCode}
          required
          minLength={6}
          maxLength={16}
          pattern="[A-Za-z0-9]{6,16}"
          title="6–16 letters or numbers"
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} font-mono uppercase`}
        />
      </label>
    </div>
  );
}

function CreateGame() {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Create a game</h2>
        <p className="text-sm text-zinc-600">
          There is no live game. Players need the join code to sign up.
        </p>
      </div>
      <ActionForm action={createGameAction} className="space-y-4">
        <GameFields />
        <SubmitButton className={primaryButtonClass} pendingLabel="Creating…">
          Create game
        </SubmitButton>
      </ActionForm>
    </Card>
  );
}

const STATUS_LABEL: Record<AdminGame["status"], string> = {
  SETUP: "Setup — no ring yet",
  ACTIVE: "Active",
  FINISHED: "Finished",
};

function GameSettings({ game }: { game: AdminGame }) {
  const finished = game.status === "FINISHED";
  return (
    <>
      <Card>
        <dl className="grid gap-4 text-sm sm:grid-cols-4">
          <Field label="Status">{STATUS_LABEL[game.status]}</Field>
          <Field label="Join code">
            <span className="font-mono">{game.joinCode}</span>
          </Field>
          <Field label="Created">{formatDateTime(game.createdAt)}</Field>
          <Field label="Started">{formatDateTime(game.startedAt)}</Field>
        </dl>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Details</h2>
        <ActionForm action={updateGameAction} className="space-y-4">
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
        <ActionForm action={setSignupsAction} className="flex flex-wrap gap-3">
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

      {!finished && (
        <Card className="space-y-3 border-red-200">
          <h2 className="text-lg font-semibold">Finish the game</h2>
          <p className="text-sm text-zinc-600">
            Ends the game for everyone. This can&apos;t be undone.
          </p>
          <ActionForm
            action={finishGameAction}
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
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
