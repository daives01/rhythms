export interface Onset {
  beatIndex: 0 | 1 | 2 | 3
  n: number
  d: number
  tuplet?: TupletInfo
}

export interface TupletInfo {
  numNotes: number      // how many notes in the tuplet
  notesOccupied: number // fits in the space of this many regular notes
}

export interface RuntimeOnset {
  id: string
  timeSec: number
  hit: boolean
  beatIndex: number
  n: number
  d: number
  tuplet?: TupletInfo
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

export type ExerciseMode = "rhythm" | "melody"

export type KeySignature = "C" | "G" | "D" | "A" | "E" | "B" | "F#" | "F" | "Bb" | "Eb"

export type MelodyDifficulty = "easy" | "medium" | "hard"

export type PlaybackMode = "metronome" | "melody" | "both"

export type MelodyLayoutMode = "live" | "page"

export type MelodySessionMode = "endless" | "exercise"

export type InstrumentTransposition = "concert" | "bb" | "eb" | "f"

export type MelodyClef = "treble" | "bass" | "alto" | "tenor"

export interface MelodyEvent {
  beatIndex: number
  durationBeats: number
  midi: number
  staffKey: string
  noteName: string
  scaleDegreeOffset: number
}

export interface RuntimeMelodyEvent extends MelodyEvent {
  id: string
  timeSec: number
  durationSec: number
  frequency: number
}

export interface MelodyBar {
  id: string
  events: MelodyEvent[]
}

export interface RuntimeMelodyBar {
  id: string
  barIndex: number
  events: RuntimeMelodyEvent[]
  width?: number
}

export interface MelodyPracticeConfig {
  seed: string
  bpm: number
  difficulty: MelodyDifficulty
  keySignature: KeySignature
  accidentals: boolean
  playbackMode: PlaybackMode
  melodyVolume: number
  instrument: InstrumentTransposition
  clef: MelodyClef
  rangeLow: number
  rangeHigh: number
  viewMode: MelodyLayoutMode
  sessionMode: MelodySessionMode
  exerciseBars: number
}

export interface GameScore {
  barsSurvived: number
  beatsSurvived: number
  totalHits: number
  timeSurvived: number
}

export interface MelodyGameScore {
  totalNotes: number
  correctNotes: number
  missedNotes: number
  wrongDetections: number
  averageResponseMs: number
  timeSurvived: number
  barsSurvived: number
  accuracy: number
}

export type HitResult = "hit" | "miss" | "extra"

export type Difficulty = "easy" | "medium" | "hard"

export interface BeatPatternOnset {
  n: number  // slot within the beat pattern (0-7 for 2-beat patterns)
  d: number  // denominator: 4 = sixteenths, 3 = triplets, 5 = quintuplets
}

export interface BeatPattern {
  id: string
  name: string
  length: 1 | 2  // in beats
  onsets: BeatPatternOnset[]
  difficulty: Difficulty[]
  tuplet?: TupletInfo   // if present, this pattern is a tuplet
}
