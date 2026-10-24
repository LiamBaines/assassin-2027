"use client";

import { useState } from "react";
import type { Leaderboard } from "@/lib/api-types";
import { LeaderboardTable } from "./leaderboard";
import { RoundSelect } from "./round-select";

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
      <RoundSelect subtle rounds={total.rounds} value={round} onChange={setRound} />
      <LeaderboardTable data={data} />
    </div>
  );
}
