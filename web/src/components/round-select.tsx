"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/select";
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
      value={value === null ? "" : String(value)}
      onChange={(v) => onChange(v === "" ? null : Number(v))}
      options={[null, ...rounds].map((r) => ({
        value: r === null ? "" : String(r),
        label: roundLabel(r),
      }))}
    />
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
