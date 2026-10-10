import type { MyRound } from "@/lib/api-types";

/** How the caller's result in a past round reads to them. */
export function roundOutcomeLabel(
  round: Pick<MyRound, "myOutcome" | "killedBy">,
): string {
  switch (round.myOutcome) {
    case "KILLED":
      return round.killedBy ? `Killed by ${round.killedBy}` : "Killed";
    case "SURVIVED":
      return "Survived";
    case "OUT":
      return "Sat out";
  }
}
