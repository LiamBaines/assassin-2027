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

/** The account's display name, chosen once at first login. */
export type Profile = { displayName: string };

export type Me = {
  email: string;
  isAdmin: boolean;
  /** Null until the user sets their name; getMe sends such users to /welcome. */
  profile: Profile | null;
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

/** The assassin's word this round; `text` is null once used. Absent when Death Sentence is off. */
export type MyKillWord = { used: boolean; text: string | null };

export type MyTarget = {
  target: { displayName: string };
  assignedAt: string;
  killWord: MyKillWord | null;
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

export type KillWordState = "UNUSED" | "ALLOCATED" | "USED";

/** A word on the game's list; `playerId` and `roundNo` are set once allocated. */
export type KillWord = {
  id: number;
  text: string;
  state: KillWordState;
  origin: "ADMIN" | "RANDOM";
  playerId: string | null;
  roundNo: number | null;
  usedAt: string | null;
};

export type KillMethodRef = { id: number; name: string };

export type KillMethod = KillMethodRef & { points: number; enabled: boolean };

/** One edit of the game's methods when starting a round; no id adds a new method. */
export type KillMethodInput = {
  id?: number;
  name: string;
  points: number;
  enabled: boolean;
};

/** A recorded kill, as the admin sees it. */
export type AdminKill = {
  killId: number;
  killer: PlayerRef;
  victim: PlayerRef;
  killMethod: KillMethodRef;
  createdAt: string;
};

export type KillResult = {
  killId: number;
  killer: PlayerRef;
  victim: PlayerRef;
  /** Null when the kill ended the round. */
  newTarget: PlayerRef | null;
  roundEnded: boolean;
  killMethod: KillMethodRef;
};

export type Ring = {
  roundId: string;
  roundNo: number;
  gameRoundNo: number;
  reason: RoundReason;
  ring: { assassin: PlayerRef; target: PlayerRef }[];
};

/** A game round as seen by the admin. */
export type AdminRound = {
  roundNo: number;
  startedAt: string;
  /** Null while the round is open. */
  endedAt: string | null;
  winner: PlayerRef | null;
  playerCount: number;
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

export type JoinRequest = { joinCode: string };
export type CreateGameRequest = { name: string; joinCode: string };
export type UpdateGameRequest = {
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
  incoming: { id: number; killerName: string; killMethod: KillMethodRef } | null;
};

export type AdminClaim = {
  id: number;
  status: KillClaimStatus;
  killerName: string;
  victimName: string;
  createdAt: string;
  killMethod: KillMethodRef;
};

export type LeaderboardEntry = {
  rank: number;
  player: PlayerRef;
  points: number;
  kills: number;
  deaths: number;
  status: PlayerStatus;
};

/** Null `roundNo` is the game total. */
export type Leaderboard = {
  roundNo: number | null;
  rounds: number[];
  entries: LeaderboardEntry[];
};

/** One entry of a game's event log; `data` is the type-specific payload. */
export type GameEvent = {
  id: number;
  type: string;
  createdAt: string;
  data: Record<string, unknown>;
};

/** A most-recent-first page; `nextBefore` is the `before` for the next page, null at the end. */
export type GameEventPage = { events: GameEvent[]; nextBefore: number | null };
