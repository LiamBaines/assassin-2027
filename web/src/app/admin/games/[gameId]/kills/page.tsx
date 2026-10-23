import { Check, Save, Skull, Swords, X } from "lucide-react";
import {
  ActionForm,
  ConfirmSubmit,
  SubmitButton,
} from "@/components/action-form";
import { KillMethodSelect } from "@/components/kill-method-select";
import { EmptyState, Panel, dangerButtonClass } from "@/components/ui";
import {
  getAdminKillMethods,
  listKills,
  listOpenDuels,
  listOpenKillClaims,
} from "@/lib/api";
import { duelAdminStatus } from "@/lib/duel";
import { formatDateTime } from "@/lib/format";
import {
  changeKillMethodAction,
  confirmClaimAction,
  dismissClaimAction,
  resolveDuelAction,
} from "../../../actions";
import { loadAdminGame } from "../load-game";

const ICON = { "aria-hidden": true, className: "size-4" } as const;

export default async function AdminKillsPage(props: {
  params: Promise<{ gameId: string }>;
}) {
  const game = await loadAdminGame(props.params);
  const [claims, duels, allMethods, kills] = await Promise.all([
    listOpenKillClaims(game.id),
    listOpenDuels(game.id),
    getAdminKillMethods(game.id),
    listKills(game.id),
  ]);
  const enabledMethods = allMethods.filter((m) => m.enabled);
  const editable = game.status !== "FINISHED";

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold">Kills</h2>
      {claims.length === 0 && duels.length === 0 && kills.length === 0 && (
        <Panel>
          <EmptyState icon={Skull} title="No kills yet">
            Kill claims that need a decision and confirmed kills will show up
            here.
          </EmptyState>
        </Panel>
      )}
      {claims.length > 0 && (
        <Panel className="space-y-3">
          <h3 className="font-semibold" data-testid="kill-claims-heading">
            Kill claims
          </h3>
          <ul className="divide-y divide-line">
            {claims.map((c) => (
              <li
                key={c.id}
                data-testid="kill-claim"
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p>
                    <span className="font-medium">{c.killerName}</span> says
                    they killed{" "}
                    <span className="font-medium">{c.victimName}</span> with{" "}
                    <span data-testid="claim-method">{c.killMethod.name}</span>
                  </p>
                  <p className="text-muted">
                    {c.status === "CONTESTED"
                      ? "Contested by the victim"
                      : "Waiting for the victim"}{" "}
                    · filed {formatDateTime(c.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ActionForm
                    action={confirmClaimAction.bind(null, game.id, c.id)}
                    className="flex items-center gap-2"
                  >
                    <ConfirmSubmit
                      label="Confirm kill"
                      confirmLabel="Confirm kill"
                      icon={<Check {...ICON} />}
                      iconOnly
                      message={`Confirm that ${c.killerName} killed ${c.victimName}? This removes ${c.victimName} from the ring.`}
                      className="!text-alive"
                      confirmClassName={dangerButtonClass}
                    />
                  </ActionForm>
                  <ActionForm
                    action={dismissClaimAction.bind(null, game.id, c.id)}
                    className="flex items-center gap-2"
                  >
                    <SubmitButton icon={<X {...ICON} />} iconOnly pendingLabel="Dismissing…">
                      Dismiss
                    </SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {duels.length > 0 && (
        <Panel className="space-y-3">
          <h3 className="font-semibold" data-testid="open-duels-heading">
            Open duels
          </h3>
          <ul className="divide-y divide-line">
            {duels.map((d) => (
              <li
                key={d.id}
                data-testid="open-duel"
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p>
                    <span className="font-medium">{d.challenger.displayName}</span>{" "}
                    challenged{" "}
                    <span className="font-medium">{d.challenged.displayName}</span>{" "}
                    to <span data-testid="duel-activity">{d.activity}</span>
                  </p>
                  <p className="text-muted" data-testid="duel-status">
                    {duelAdminStatus(d)} · filed {formatDateTime(d.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[d.challenger, d.challenged].map((p) => (
                    <ActionForm
                      key={p.id}
                      action={resolveDuelAction.bind(null, game.id, d.id, p.id)}
                      className="flex items-center gap-2"
                    >
                      <ConfirmSubmit
                        label={`${p.displayName} won`}
                        confirmLabel="Resolve duel"
                        icon={<Swords {...ICON} />}
                        message={`Declare ${p.displayName} the winner? This ends the duel and scores the kill.`}
                        confirmClassName={dangerButtonClass}
                      />
                    </ActionForm>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {kills.length > 0 && (
        <Panel className="space-y-3">
          <h3 className="font-semibold">Confirmed kills</h3>
          <ul className="divide-y divide-line">
            {kills.map((k) => (
              <li
                key={k.killId}
                data-testid="kill-row"
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <p>
                  <span className="font-medium">{k.killer.displayName}</span>{" "}
                  killed{" "}
                  <span className="font-medium">{k.victim.displayName}</span>{" "}
                  with <span data-testid="kill-method">{k.killMethod.name}</span>{" "}
                  <span className="text-muted">
                    · {formatDateTime(k.createdAt)}
                  </span>
                </p>
                {editable && (
                  <ActionForm
                    action={changeKillMethodAction.bind(null, game.id, k.killId)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <KillMethodSelect
                      methods={enabledMethods}
                      defaultValue={k.killMethod.id}
                    />
                    <SubmitButton icon={<Save {...ICON} />} iconOnly pendingLabel="Saving…">
                      Change method
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
