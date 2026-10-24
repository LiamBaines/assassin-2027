import { Check, Swords, X } from "lucide-react";
import {
  ActionForm,
  ConfirmSubmit,
  SubmitButton,
} from "@/components/action-form";
import { EventLog } from "@/components/event-log";
import { Panel, dangerButtonClass } from "@/components/ui";
import { getAdminEvents, getAdminKillMethods, listOpenDuels, listOpenKillClaims } from "@/lib/api";
import { duelAdminStatus } from "@/lib/duel";
import { formatDateTime } from "@/lib/format";
import { changeKillMethodAction, confirmClaimAction, dismissClaimAction, resolveDuelAction } from "../../../actions";
import { loadAdminGame } from "../load-game";

const ICON = { "aria-hidden": true, className: "size-4" } as const;

export default async function AdminLogPage(props: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ before?: string | string[] }>;
}) {
  const game = await loadAdminGame(props.params);
  const raw = (await props.searchParams).before;
  const before = typeof raw === "string" ? Number(raw) : NaN;
  const [claims, duels, killMethods, page] = await Promise.all([
    listOpenKillClaims(game.id),
    listOpenDuels(game.id),
    getAdminKillMethods(game.id),
    getAdminEvents(
      game.id,
      Number.isSafeInteger(before) && before > 0 ? before : undefined,
    ).catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold">Log</h2>
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
      <EventLog
        page={page}
        audience="admin"
        moreHref={(b) => `?before=${b}`}
        editKill={{
          methods: killMethods.filter((m) => m.enabled),
          action: changeKillMethodAction.bind(null, game.id),
        }}
      />
    </div>
  );
}
