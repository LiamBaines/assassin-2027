"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import { leaderboardHref } from "@/lib/leaderboard";
import { roundLabel } from "./leaderboard";

/** Total plus one option per round. */
export function RoundSelect({
  rounds,
  value,
  onChange,
}: {
  rounds: number[];
  value: number | null;
  onChange: (round: number | null) => void;
}) {
  return (
    <Select
      aria-label="Leaderboard view"
      data-testid="leaderboard-view"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    >
      {[null, ...rounds].map((r) => (
        <option key={r ?? "total"} value={r ?? ""}>
          {roundLabel(r)}
        </option>
      ))}
    </Select>
  );
}

/** Admin variant: the round lives in `?round=` so the server fetches that board. */
export function AdminRoundSelect({
  rounds,
  value,
  basePath,
}: {
  rounds: number[];
  value: number | null;
  basePath: string;
}) {
  const router = useRouter();
  return (
    <RoundSelect
      rounds={rounds}
      value={value}
      onChange={(r) => router.push(leaderboardHref(basePath, r))}
    />
  );
}
