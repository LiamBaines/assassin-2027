"use client";

import { useState } from "react";
import type { Leaderboard } from "@/lib/api-types";
import { LeaderboardTable, roundLabel, viewTabClass } from "./leaderboard";

/** Total plus one board per round, all fetched up front so switching is instant. */
export function PlayerLeaderboard({
  total,
  rounds,
  initialRound,
}: {
  total: Leaderboard;
  rounds: Record<number, Leaderboard>;
  initialRound: number | null;
}) {
  const [round, setRound] = useState<number | null>(
    initialRound !== null && rounds[initialRound] ? initialRound : null,
  );
  const data = round === null ? total : rounds[round];
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Leaderboard view" className="flex flex-wrap gap-2">
        {[null, ...total.rounds].map((r) => (
          <button
            key={r ?? "total"}
            type="button"
            onClick={() => setRound(r)}
            aria-current={r === round ? "page" : undefined}
            data-testid="leaderboard-view"
            className={viewTabClass(r === round)}
          >
            {roundLabel(r)}
          </button>
        ))}
      </div>
      <LeaderboardTable data={data} />
    </div>
  );
}
