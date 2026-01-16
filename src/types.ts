export interface Onset {
  beatIndex: 0 | 1 | 2 | 3
  n: number
  d: number
}

export interface RuntimeOnset {
  id: string
  timeSec: number
  hit: boolean
  beatIndex: number
  n: number
  d: number
}

export interface Bar {
  id: string
  onsets: Onset[]
}

export interface RuntimeBar {
  id: string
  barIndex: number
  onsets: RuntimeOnset[]
  width?: number  // calculated width for variable-width rendering
}

export type GameState = "idle" | "countIn" | "running" | "gameOver"

export interface GameScore {
  barsSurvived: number
  beatsSurvived: number
  totalHits: number
  timeSurvived: number
}

export type HitResult = "hit" | "miss" | "extra"

export type Difficulty = "easy" | "medium" | "hard"

export interface BeatPatternOnset {
  n: number  // slot within the beat pattern (0-7 for 2-beat patterns)
  d: number  // always 4 (sixteenth note grid)
}

export interface BeatPattern {
  id: string
  name: string
  length: 1 | 2  // in beats
  onsets: BeatPatternOnset[]
  difficulty: Difficulty[]
}
