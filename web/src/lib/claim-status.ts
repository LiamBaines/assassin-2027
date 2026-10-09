import type { KillClaimStatus } from "@/lib/api-types";

/** Whether a claim can still be withdrawn or resolved. */
export function isOpenClaim(status: KillClaimStatus): boolean {
  return status === "PENDING" || status === "CONTESTED";
}

/** How the killer reads their own claim's status. */
export function outgoingClaimLabel(status: KillClaimStatus): string {
  switch (status) {
    case "PENDING":
      return "Waiting for your target to respond";
    case "CONTESTED":
      return "Your target contested the kill. The organiser will decide.";
    case "CONFIRMED":
      return "Kill confirmed";
    case "DISMISSED":
      return "The organiser dismissed your claim";
    case "WITHDRAWN":
      return "You withdrew your claim";
    case "VOIDED":
      return "Your claim is no longer valid";
  }
}
