// Response shapes of the Spring API (see docs/architecture.md, API table).

export type GameStatus = "SETUP" | "ACTIVE" | "FINISHED";
export type PlayerStatus = "ALIVE" | "DEAD" | "REMOVED";
export type RoundReason = "INITIAL" | "SHAKEUP";

export type GameSummary = {
  id: string;
  name: string;
  status: GameStatus;
  signupsOpen: boolean;
  /** Null before round 1 starts. */
  currentRoundNo: number | null;
};

export type PlayerSummary = {
  id: string;
  displayName: string;
  status: PlayerStatus;
  joinedAt: string;
};

/** One game the caller plays in, with their player in it. */
export type MyGame = { game: GameSummary; player: PlayerSummary };

export type Me = {
  email: string;
  isAdmin: boolean;
  /** Every game the caller plays in, including finished ones, newest join first. */
  games: MyGame[];
};

export type JoinPreview = {
  gameId: string;
  name: string;
  status: GameStatus;
  signupsOpen: boolean;
  alreadyJoined: boolean;
};

export type PlayerOutcome = "KILLED" | "SURVIVED" | "OUT";

/** A closed round as seen by the caller. */
export type MyRound = {
  roundNo: number;
  startedAt: string;
  endedAt: string;
  winner: PlayerRef | null;
  myOutcome: PlayerOutcome;
  killedBy: string | null;
};

export type MyTarget = {
  target: { displayName: string };
  assignedAt: string;
};

/** PlayerStatus plus WAITING: alive but without a target yet (computed by the API). */
export type RosterStatus = PlayerStatus | "WAITING";

export type RosterEntry = { displayName: string; status: RosterStatus };

export type Roster = { players: RosterEntry[] };

export type AdminGame = {
  id: string;
  name: string;
  joinCode: string;
  status: GameStatus;
  signupsOpen: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  playerCount: number;
};

export type PlayerRef = { id: string; displayName: string };

export type AdminPlayer = {
  id: string;
  displayName: string;
  email: string;
  status: PlayerStatus;
  joinedAt: string;
  currentTarget: PlayerRef | null;
};

export type KillResult = {
  killId: number;
  killer: PlayerRef;
  victim: PlayerRef;
  /** Null when the kill ended the round. */
  newTarget: PlayerRef | null;
  roundEnded: boolean;
};

export type Ring = {
  roundId: string;
  roundNo: number;
  gameRoundNo: number;
  reason: RoundReason;
  ring: { assassin: PlayerRef; target: PlayerRef }[];
};

export type RoundSummary = {
  roundId: string;
  roundNo: number;
  gameRoundNo: number;
  reason: RoundReason;
  playerCount: number;
  createdBy: string;
  createdAt: string;
};

export type JoinRequest = { displayName: string; joinCode: string };
export type CreateGameRequest = { name: string; joinCode: string };
export type UpdateGameRequest = {
  name?: string;
  joinCode?: string;
  signupsOpen?: boolean;
  status?: "FINISHED";
};

export type KillClaimStatus =
  | "PENDING"
  | "CONTESTED"
  | "CONFIRMED"
  | "DISMISSED"
  | "WITHDRAWN"
  | "VOIDED";

export type ClaimStatus = { id: number; status: KillClaimStatus };

export type ClaimAcceptResult = {
  status: KillClaimStatus;
  roundEnded: boolean;
};

export type MyClaims = {
  outgoing: ClaimStatus | null;
  incoming: { id: number; killerName: string } | null;
};

export type AdminClaim = {
  id: number;
  status: KillClaimStatus;
  killerName: string;
  victimName: string;
  createdAt: string;
};
