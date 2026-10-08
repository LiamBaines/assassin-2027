// Response shapes of the Spring API (see docs/architecture.md, API table).

export type GameStatus = "SETUP" | "ACTIVE" | "FINISHED";
export type PlayerStatus = "ALIVE" | "DEAD" | "REMOVED";
export type RoundReason = "INITIAL" | "SHAKEUP";

export type MeGame = {
  id: string;
  name: string;
  status: GameStatus;
  signupsOpen: boolean;
};

export type MePlayer = {
  id: string;
  displayName: string;
  status: PlayerStatus;
  joinedAt: string;
};

export type Me = {
  email: string;
  isAdmin: boolean;
  game: MeGame | null;
  player: MePlayer | null;
};

export type MyTarget = {
  target: { displayName: string };
  assignedAt: string;
};

export type AdminGame = {
  id: string;
  name: string;
  joinCode: string;
  status: GameStatus;
  signupsOpen: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
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

export type Ring = {
  roundId: string;
  roundNo: number;
  reason: RoundReason;
  ring: { assassin: PlayerRef; target: PlayerRef }[];
};

export type RoundSummary = {
  roundId: string;
  roundNo: number;
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
