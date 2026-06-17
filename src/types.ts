export type GameStateStatus = 'idle' | 'playing' | 'gameover';

export interface GameStats {
  score: number;
  highScore: number;
  obstaclesDodged: number;
  speedMultiplier: number;
}

export type TMAction = 'jump' | 'crouch' | 'neutral';

export interface TMConfig {
  modelUrl: string;
  isModelLoaded: boolean;
  isWebcamActive: boolean;
  mappings: {
    jump: string;      // User assigned class name for jump
    crouch: string;    // User assigned class name for crouch
    neutral: string;   // User assigned class name for neutral
  };
  confidenceThreshold: number; // e.g. 0.80
}

export interface PredictionResult {
  className: string;
  probability: number;
}
