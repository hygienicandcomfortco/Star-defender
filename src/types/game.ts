export type DifficultyTier = "rookie" | "pro" | "elite";
export type PowerUpType = "overdrive" | "bullet";

export interface ActivePowerUpState {
  type: PowerUpType;
  remainingSeconds: number;
  durationSeconds: number;
}

export interface RuntimeGameState {
  score: number;
  lives: number;
  elapsedSeconds: number;
  difficulty: DifficultyTier;
  wave: number;
  bestScore: number;
  isPaused: boolean;
  activePowerUps: ActivePowerUpState[];
}

export const createRuntimeGameState = (bestScore: number): RuntimeGameState => ({
  score: 0,
  lives: 3,
  elapsedSeconds: 0,
  difficulty: "rookie",
  wave: 1,
  bestScore,
  isPaused: false,
  activePowerUps: []
});
