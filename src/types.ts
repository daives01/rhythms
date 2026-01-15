// Rational beat position representation
export interface Onset {
  beatIndex: 0 | 1 | 2 | 3 // Which beat in the bar (0-3 for 4/4)
  n: number // Numerator of subdivision
  d: number // Denominator (4 = 16ths, 3 = triplets, etc.)
}

// Runtime onset with precomputed timing
export interface RuntimeOnset {
  id: string
  timeSec: number // Absolute time in AudioContext seconds
  hit: boolean
  beatIndex: number
  n: number
  d: number
}

// A single bar of rhythm
export interface Bar {
  id: string
  onsets: Onset[]
}

// Runtime bar with precomputed onset times
export interface RuntimeBar {
  id: string
  barIndex: number // Absolute bar index from start
  onsets: RuntimeOnset[]
}

// Game state machine
export type GameState = "idle" | "countIn" | "running" | "gameOver"

// Score tracking
export interface GameScore {
  barsSurvived: number
  beatsSurvived: number
  totalHits: number
  timeSurvived: number // in seconds
}

// Judge result for a single hit
export type HitResult = "hit" | "miss" | "extra"

// Transport state
export interface TransportState {
  isRunning: boolean
  startTimeSec: number
  countInComplete: boolean
  currentBeat: number
  currentBar: number
}

// Game settings
export interface GameSettings {
  bpm: number
  difficulty: number // 1-5
  toleranceMs: number // Hit window in ms
}

export const DEFAULT_SETTINGS: GameSettings = {
  bpm: 100,
  difficulty: 2,
  toleranceMs: 80,
}
