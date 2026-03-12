import type { InstrumentTransposition, KeySignature, MelodyClef, MelodyDifficulty, MelodyEvent } from "@/types"
import { SeededRandom } from "@/lib/random"

export interface ScaleNote {
  midi: number
  staffKey: string
  noteName: string
  scaleDegreeOffset: number
}

type PhraseContour = "ascending" | "descending" | "arch" | "invertedArch" | "pedal"

interface KeyDefinition {
  tonicMidi: number
  semitones: number[]
  names: string[]
}

const ACCIDENTAL_RATE = 0.2
const FLAT_KEYS = new Set<KeySignature>(["F", "Bb", "Eb"])
const SHARP_CHROMATIC_NAMES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"]
const FLAT_CHROMATIC_NAMES = ["c", "db", "d", "eb", "e", "f", "gb", "g", "ab", "a", "bb", "b"]
const NOTE_OPTION_NAMES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"]

export const MIN_WRITTEN_RANGE_MIDI = 40
export const MAX_WRITTEN_RANGE_MIDI = 93
export const MIN_WRITTEN_RANGE_SPAN = 12
const MIN_GENERATED_MIDI = 28
const MAX_GENERATED_MIDI = 100
const MIN_SCALE_NOTE_COUNT = 5

export const DEFAULT_WRITTEN_RANGE_BY_CLEF: Record<MelodyClef, { low: number; high: number }> = {
  treble: { low: 55, high: 81 },
  bass: { low: 40, high: 64 },
  alto: { low: 48, high: 72 },
  tenor: { low: 45, high: 69 },
}

const KEY_DEFINITIONS: Record<KeySignature, KeyDefinition> = {
  C: { tonicMidi: 60, semitones: [0, 2, 4, 5, 7, 9, 11], names: ["c", "d", "e", "f", "g", "a", "b"] },
  G: { tonicMidi: 67, semitones: [0, 2, 4, 5, 7, 9, 11], names: ["g", "a", "b", "c", "d", "e", "f#"] },
  D: { tonicMidi: 62, semitones: [0, 2, 4, 5, 7, 9, 11], names: ["d", "e", "f#", "g", "a", "b", "c#"] },
  A: { tonicMidi: 57, semitones: [0, 2, 4, 5, 7, 9, 11], names: ["a", "b", "c#", "d", "e", "f#", "g#"] },
  E: { tonicMidi: 64, semitones: [0, 2, 4, 5, 7, 9, 11], names: ["e", "f#", "g#", "a", "b", "c#", "d#"] },
  B: { tonicMidi: 59, semitones: [0, 2, 4, 5, 7, 9, 11], names: ["b", "c#", "d#", "e", "f#", "g#", "a#"] },
  "F#": { tonicMidi: 66, semitones: [0, 2, 4, 5, 7, 9, 11], names: ["f#", "g#", "a#", "b", "c#", "d#", "e#"] },
  F: { tonicMidi: 65, semitones: [0, 2, 4, 5, 7, 9, 11], names: ["f", "g", "a", "bb", "c", "d", "e"] },
  Bb: { tonicMidi: 58, semitones: [0, 2, 4, 5, 7, 9, 11], names: ["bb", "c", "d", "eb", "f", "g", "a"] },
  Eb: { tonicMidi: 63, semitones: [0, 2, 4, 5, 7, 9, 11], names: ["eb", "f", "g", "ab", "bb", "c", "d"] },
}

const WRITTEN_KEY_BY_INSTRUMENT: Record<InstrumentTransposition, Record<KeySignature, KeySignature>> = {
  concert: { C: "C", G: "G", D: "D", A: "A", E: "E", B: "B", "F#": "F#", F: "F", Bb: "Bb", Eb: "Eb" },
  bb: { C: "D", G: "A", D: "E", A: "B", E: "F#", B: "F#", "F#": "F#", F: "G", Bb: "C", Eb: "F" },
  eb: { C: "A", G: "E", D: "B", A: "F#", E: "C", B: "G", "F#": "D", F: "D", Bb: "G", Eb: "C" },
  f: { C: "G", G: "D", D: "A", A: "E", E: "B", B: "F#", "F#": "F#", F: "C", Bb: "F", Eb: "Bb" },
}

const WRITTEN_SEMITONES_BY_INSTRUMENT: Record<InstrumentTransposition, number> = {
  concert: 0,
  bb: 2,
  eb: 9,
  f: 7,
}

function formatDisplayName(name: string, octave: number): string {
  const letter = name.charAt(0).toUpperCase()
  const accidental = name.slice(1).replace(/#/g, "♯").replace(/b/g, "♭")
  return `${letter}${accidental}${octave}`
}

const RHYTHM_PATTERNS: Record<MelodyDifficulty, number[][]> = {
  easy: [
    [1, 1, 1, 1],
    [2, 1, 1],
    [1, 1, 2],
    [1, 2, 1],
    [2, 2],
    [1, 0.5, 0.5, 1, 1],
    [1, 1, 0.5, 0.5, 1],
  ],
  medium: [
    [1, 1, 1, 1],
    [2, 1, 1],
    [1, 1, 2],
    [1, 2, 1],
    [2, 2],
    [1, 0.5, 0.5, 1, 1],
    [1, 1, 0.5, 0.5, 1],
    [1, 0.5, 0.5, 0.5, 0.5, 1],
    [0.5, 0.5, 1, 1, 1],
    [1, 1, 0.5, 0.5, 0.5, 0.5],
  ],
  hard: [
    [1, 1, 1, 1],
    [2, 1, 1],
    [1, 1, 2],
    [1, 2, 1],
    [2, 2],
    [1, 0.5, 0.5, 1, 1],
    [1, 1, 0.5, 0.5, 1],
    [1, 0.5, 0.5, 0.5, 0.5, 1],
    [0.5, 0.5, 1, 1, 1],
    [1, 1, 0.5, 0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5, 0.5, 1, 1],
    [1, 0.5, 0.5, 1, 0.5, 0.5],
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1],
  ],
}

const STEP_WEIGHTS: Record<MelodyDifficulty, { step: number; weight: number }[]> = {
  easy: [
    { step: -2, weight: 1 },
    { step: -1, weight: 4 },
    { step: 0, weight: 2 },
    { step: 1, weight: 4 },
    { step: 2, weight: 1 },
  ],
  medium: [
    { step: -3, weight: 1 },
    { step: -2, weight: 2 },
    { step: -1, weight: 4 },
    { step: 0, weight: 1 },
    { step: 1, weight: 4 },
    { step: 2, weight: 2 },
    { step: 3, weight: 1 },
  ],
  hard: [
    { step: -4, weight: 1 },
    { step: -3, weight: 2 },
    { step: -2, weight: 3 },
    { step: -1, weight: 4 },
    { step: 0, weight: 1 },
    { step: 1, weight: 4 },
    { step: 2, weight: 3 },
    { step: 3, weight: 2 },
    { step: 4, weight: 1 },
  ],
}

export const KEY_SIGNATURE_OPTIONS: KeySignature[] = ["C", "G", "D", "A", "F", "Bb", "Eb"]

export function getVexKeySignature(keySignature: KeySignature): string {
  return keySignature
}

export function transposeKeySignature(keySignature: KeySignature, instrument: InstrumentTransposition): KeySignature {
  return WRITTEN_KEY_BY_INSTRUMENT[instrument][keySignature]
}

export function reverseTransposeKeySignature(writtenKey: KeySignature, instrument: InstrumentTransposition): KeySignature {
  const mapping = WRITTEN_KEY_BY_INSTRUMENT[instrument]
  for (const [concert, written] of Object.entries(mapping)) {
    if (written === writtenKey) return concert as KeySignature
  }
  return writtenKey
}

export function getWrittenKeyOptions(instrument: InstrumentTransposition): KeySignature[] {
  const mapping = WRITTEN_KEY_BY_INSTRUMENT[instrument]
  return KEY_SIGNATURE_OPTIONS.map((concertKey) => mapping[concertKey])
}

export function transposeMidiForInstrument(midi: number, instrument: InstrumentTransposition): number {
  return midi + WRITTEN_SEMITONES_BY_INSTRUMENT[instrument]
}

export function reverseTransposeMidiForInstrument(midi: number, instrument: InstrumentTransposition): number {
  return midi - WRITTEN_SEMITONES_BY_INSTRUMENT[instrument]
}

export function clampWrittenMidi(midi: number): number {
  return Math.max(MIN_WRITTEN_RANGE_MIDI, Math.min(MAX_WRITTEN_RANGE_MIDI, Math.round(midi)))
}

export function normalizeWrittenRange(low: number, high: number): { low: number; high: number } {
  let clampedLow = clampWrittenMidi(low)
  let clampedHigh = clampWrittenMidi(high)

  if (clampedLow > clampedHigh) {
    ;[clampedLow, clampedHigh] = [clampedHigh, clampedLow]
  }

  if (clampedHigh - clampedLow < MIN_WRITTEN_RANGE_SPAN) {
    const deficit = MIN_WRITTEN_RANGE_SPAN - (clampedHigh - clampedLow)

    if (clampedHigh + deficit <= MAX_WRITTEN_RANGE_MIDI) {
      clampedHigh += deficit
    } else if (clampedLow - deficit >= MIN_WRITTEN_RANGE_MIDI) {
      clampedLow -= deficit
    } else {
      clampedLow = MIN_WRITTEN_RANGE_MIDI
      clampedHigh = MIN_WRITTEN_RANGE_MIDI + MIN_WRITTEN_RANGE_SPAN
    }
  }

  return { low: clampedLow, high: clampedHigh }
}

export function getDefaultWrittenRange(clef: MelodyClef): { low: number; high: number } {
  return DEFAULT_WRITTEN_RANGE_BY_CLEF[clef]
}

export function getConcertRangeForInstrument(low: number, high: number, instrument: InstrumentTransposition): { low: number; high: number } {
  const normalized = normalizeWrittenRange(low, high)
  const concertLow = reverseTransposeMidiForInstrument(normalized.low, instrument)
  const concertHigh = reverseTransposeMidiForInstrument(normalized.high, instrument)

  return concertLow <= concertHigh
    ? { low: concertLow, high: concertHigh }
    : { low: concertHigh, high: concertLow }
}

export function formatMidiNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  const name = NOTE_OPTION_NAMES[((midi % 12) + 12) % 12]
  return formatDisplayName(name, octave)
}

export function getWrittenRangeNoteOptions(): { value: number; label: string }[] {
  return Array.from({ length: MAX_WRITTEN_RANGE_MIDI - MIN_WRITTEN_RANGE_MIDI + 1 }, (_, index) => {
    const value = MIN_WRITTEN_RANGE_MIDI + index
    return {
      value,
      label: formatMidiNoteName(value),
    }
  })
}

export function durationToVex(durationBeats: number): "h" | "q" | "8" {
  if (durationBeats === 2) return "h"
  if (durationBeats === 0.5) return "8"
  return "q"
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

function getPitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

function getRelativePitchClass(keySignature: KeySignature, midi: number): number {
  const tonicPitchClass = getPitchClass(KEY_DEFINITIONS[keySignature].tonicMidi)
  return (getPitchClass(midi) - tonicPitchClass + 12) % 12
}

function spellMidiForKey(keySignature: KeySignature, midi: number): string {
  const definition = KEY_DEFINITIONS[keySignature]
  const relativePitchClass = getRelativePitchClass(keySignature, midi)
  const scaleDegreeIndex = definition.semitones.indexOf(relativePitchClass)

  if (scaleDegreeIndex >= 0) {
    return definition.names[scaleDegreeIndex]
  }

  const chromaticNames = FLAT_KEYS.has(keySignature) ? FLAT_CHROMATIC_NAMES : SHARP_CHROMATIC_NAMES
  return chromaticNames[getPitchClass(midi)]
}

function createScaleNote(keySignature: KeySignature, midi: number, scaleDegreeOffset: number): ScaleNote {
  const octave = Math.floor(midi / 12) - 1
  const name = spellMidiForKey(keySignature, midi)

  return {
    midi,
    staffKey: `${name}/${octave}`,
    noteName: formatDisplayName(name, octave),
    scaleDegreeOffset,
  }
}

function isPitchInKeySignature(keySignature: KeySignature, midi: number): boolean {
  return KEY_DEFINITIONS[keySignature].semitones.includes(getRelativePitchClass(keySignature, midi))
}

function buildScaleRangeWithinBounds(keySignature: KeySignature, lowMidi: number, highMidi: number): ScaleNote[] {
  const definition = KEY_DEFINITIONS[keySignature]
  const notes: ScaleNote[] = []

  for (let scaleOffset = -42; scaleOffset <= 42; scaleOffset++) {
    const normalizedDegree = ((scaleOffset % 7) + 7) % 7
    const octaveOffset = Math.floor(scaleOffset / 7)
    const midi = definition.tonicMidi + octaveOffset * 12 + definition.semitones[normalizedDegree]

    if (midi < lowMidi || midi > highMidi) continue

    notes.push(createScaleNote(keySignature, midi, scaleOffset))
  }

  return notes
}

export function buildScaleRange(keySignature: KeySignature, lowMidi = DEFAULT_WRITTEN_RANGE_BY_CLEF.treble.low, highMidi = DEFAULT_WRITTEN_RANGE_BY_CLEF.treble.high): ScaleNote[] {
  let { low, high } = lowMidi <= highMidi ? { low: lowMidi, high: highMidi } : { low: highMidi, high: lowMidi }
  let notes = buildScaleRangeWithinBounds(keySignature, low, high)

  while (notes.length < MIN_SCALE_NOTE_COUNT && (low > MIN_GENERATED_MIDI || high < MAX_GENERATED_MIDI)) {
    if (low > MIN_GENERATED_MIDI) low -= 1
    if (notes.length >= MIN_SCALE_NOTE_COUNT) break
    if (high < MAX_GENERATED_MIDI) high += 1
    notes = buildScaleRangeWithinBounds(keySignature, low, high)
  }

  return notes
}

function getNearestScaleIndex(scale: ScaleNote[], targets: number[]): number {
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY

  for (const target of targets) {
    scale.forEach((note, index) => {
      const distance = Math.abs(note.midi - target)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })
  }

  return bestIndex
}

function clampIndex(index: number, maxIndex: number): number {
  return Math.max(0, Math.min(maxIndex, index))
}

function chooseStartingIndex(scale: ScaleNote[], rng: SeededRandom): number {
  const centerTargets = [64, 67, 69]
  const center = getNearestScaleIndex(scale, centerTargets)
  const offsets = [0, -2, 2]
  return clampIndex(center + rng.pick(offsets), scale.length - 1)
}

function maybeResetPhrase(scale: ScaleNote[], currentIndex: number, rng: SeededRandom): number {
  if (rng.random() > 0.18) return currentIndex

  const anchor = getNearestScaleIndex(scale, [60, 64, 67])
  const offset = rng.pick([-2, 0, 2])
  return clampIndex(anchor + offset, scale.length - 1)
}

function wrapScaleDegree(scaleDegreeOffset: number): number {
  return ((scaleDegreeOffset % 7) + 7) % 7
}

function isStableScaleDegree(scaleDegreeOffset: number): boolean {
  return [0, 2, 4].includes(wrapScaleDegree(scaleDegreeOffset))
}

function choosePhraseLength(rng: SeededRandom, difficulty: MelodyDifficulty): number {
  if (difficulty === "easy") return rng.pick([2, 2, 3])
  if (difficulty === "medium") return rng.pick([2, 3, 3, 4])
  return rng.pick([3, 4, 4])
}

function choosePhraseContour(rng: SeededRandom, difficulty: MelodyDifficulty): PhraseContour {
  if (difficulty === "easy") {
    return rng.pick(["ascending", "descending", "arch"])
  }

  if (difficulty === "medium") {
    return rng.pick(["ascending", "descending", "arch", "invertedArch"])
  }

  return rng.pick(["ascending", "descending", "arch", "invertedArch", "pedal"])
}

function choosePhraseSpan(rng: SeededRandom, difficulty: MelodyDifficulty): number {
  if (difficulty === "easy") return rng.pick([2, 3, 3, 4])
  if (difficulty === "medium") return rng.pick([3, 4, 4, 5])
  return rng.pick([4, 5, 5, 6])
}

function pickWeightedEntry<T extends { weight: number }>(rng: SeededRandom, entries: T[]): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  let threshold = rng.random() * total

  for (const entry of entries) {
    threshold -= entry.weight
    if (threshold <= 0) return entry
  }

  return entries[entries.length - 1]
}

function chooseRhythmPattern(
  rng: SeededRandom,
  difficulty: MelodyDifficulty,
  previousPattern?: number[]
): number[] {
  if (previousPattern && rng.random() < 0.58) {
    return previousPattern
  }

  return rng.pick(RHYTHM_PATTERNS[difficulty])
}

function buildMotif(rng: SeededRandom, difficulty: MelodyDifficulty): number[] {
  const source = STEP_WEIGHTS[difficulty].filter((entry) => Math.abs(entry.step) <= 2 && entry.step !== 0)
  const motifLength = difficulty === "easy" ? rng.pick([2, 3]) : rng.pick([3, 3, 4])
  const motif: number[] = []

  for (let index = 0; index < motifLength; index++) {
    let step = pickWeightedEntry(rng, source).step

    if (index > 0 && rng.random() < 0.35) {
      step = motif[index - 1] * -1
    }

    motif.push(step)
  }

  return motif
}

function choosePhraseAnchor(scale: ScaleNote[], currentIndex: number, rng: SeededRandom): number {
  const center = getNearestScaleIndex(scale, [60, 64, 67])
  const blended = Math.round((currentIndex + center) / 2)
  const anchor = rng.random() < 0.6 ? blended : maybeResetPhrase(scale, currentIndex, rng)
  return clampIndex(anchor, scale.length - 1)
}

function getContourOffset(contour: PhraseContour, progress: number, span: number): number {
  if (contour === "ascending") return Math.round(span * progress)
  if (contour === "descending") return -Math.round(span * progress)
  if (contour === "arch") {
    const normalized = progress <= 0.5 ? progress * 2 : (1 - progress) * 2
    return Math.round(span * normalized)
  }
  if (contour === "invertedArch") {
    const normalized = progress <= 0.5 ? progress * 2 : (1 - progress) * 2
    return -Math.round(span * normalized)
  }

  return Math.round((progress - 0.5) * Math.min(2, span))
}

function getContourTargetIndex(scale: ScaleNote[], state: MelodyGeneratorState, progress: number): number {
  return clampIndex(state.phraseAnchorIndex + getContourOffset(state.contour, progress, state.phraseSpan), scale.length - 1)
}

function getPreferredDirection(state: MelodyGeneratorState, progress: number): number {
  if (state.contour === "ascending") return 1
  if (state.contour === "descending") return -1
  if (state.contour === "arch") return progress < 0.5 ? 1 : -1
  if (state.contour === "invertedArch") return progress < 0.5 ? -1 : 1
  return state.driftDirection
}

function startPhrase(
  scale: ScaleNote[],
  rng: SeededRandom,
  difficulty: MelodyDifficulty,
  currentIndex: number,
  previousRhythmPattern?: number[]
): MelodyGeneratorState {
  const phraseAnchorIndex = choosePhraseAnchor(scale, currentIndex, rng)

  return {
    currentIndex: phraseAnchorIndex,
    lastInterval: 0,
    phraseBarIndex: 0,
    phraseLengthBars: choosePhraseLength(rng, difficulty),
    contour: choosePhraseContour(rng, difficulty),
    phraseAnchorIndex,
    phraseSpan: choosePhraseSpan(rng, difficulty),
    motifSteps: buildMotif(rng, difficulty),
    motifCursor: 0,
    driftDirection: rng.random() < 0.5 ? -1 : 1,
    repeatStreak: 0,
    rhythmPattern: chooseRhythmPattern(rng, difficulty, previousRhythmPattern),
  }
}

function ensurePhraseState(
  scale: ScaleNote[],
  rng: SeededRandom,
  difficulty: MelodyDifficulty,
  state?: MelodyGeneratorState
): MelodyGeneratorState {
  if (!state) {
    return startPhrase(scale, rng, difficulty, chooseStartingIndex(scale, rng))
  }

  if (state.phraseBarIndex >= state.phraseLengthBars) {
    return startPhrase(scale, rng, difficulty, state.currentIndex, state.rhythmPattern)
  }

  if (!state.rhythmPattern) {
    return {
      ...state,
      rhythmPattern: chooseRhythmPattern(rng, difficulty),
    }
  }

  return { ...state }
}

function chooseCadenceIndex(scale: ScaleNote[], currentIndex: number): number {
  const stableTargets = [0, 2, 4]
  let bestIndex = currentIndex
  let bestScore = Number.POSITIVE_INFINITY

  scale.forEach((note, index) => {
    if (!stableTargets.includes(wrapScaleDegree(note.scaleDegreeOffset))) return

    const distance = Math.abs(index - currentIndex)
    const tonicBias = wrapScaleDegree(note.scaleDegreeOffset) === 0 ? -0.5 : 0
    const score = distance + tonicBias
    if (score < bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  return bestIndex
}

function chooseApproachIndex(scale: ScaleNote[], currentIndex: number, cadenceIndex: number): number {
  const options = [cadenceIndex - 2, cadenceIndex - 1, cadenceIndex + 1, cadenceIndex + 2]
    .map((index) => clampIndex(index, scale.length - 1))
    .filter((index, optionIndex, array) => array.indexOf(index) === optionIndex && index !== cadenceIndex)

  if (options.length === 0) return currentIndex

  return options.reduce((best, index) =>
    Math.abs(index - currentIndex) < Math.abs(best - currentIndex) ? index : best
  )
}

function pickNextStep(
  rng: SeededRandom,
  difficulty: MelodyDifficulty,
  state: MelodyGeneratorState,
  targetIndex: number,
  preferredDirection: number,
  scale: ScaleNote[]
): number {
  const options = STEP_WEIGHTS[difficulty].map((entry) => {
    let nextIndex = clampIndex(state.currentIndex + entry.step, scale.length - 1)
    let actualStep = nextIndex - state.currentIndex

    if (nextIndex <= 1 && entry.step < 0) {
      nextIndex = clampIndex(state.currentIndex + Math.abs(entry.step), scale.length - 1)
      actualStep = nextIndex - state.currentIndex
    }

    if (nextIndex >= scale.length - 2 && entry.step > 0) {
      nextIndex = clampIndex(state.currentIndex - Math.abs(entry.step), scale.length - 1)
      actualStep = nextIndex - state.currentIndex
    }

    const distanceToTarget = Math.abs(nextIndex - targetIndex)
    const motifStep = state.motifSteps[state.motifCursor % state.motifSteps.length]
    const direction = Math.sign(actualStep)
    const recoveringLeap =
      Math.abs(state.lastInterval) >= 3 &&
      direction !== 0 &&
      Math.sign(state.lastInterval) !== direction

    let weight = entry.weight
    weight += Math.max(0, 6 - distanceToTarget * 2)
    weight += Math.max(0, 4 - Math.abs(actualStep - motifStep) * 2)
    weight += direction === preferredDirection ? 3 : 0
    weight += recoveringLeap ? 5 : 0
    weight -= actualStep === 0 && state.repeatStreak >= 1 ? 4 : 0
    weight -= Math.abs(actualStep) >= 3 && difficulty !== "hard" ? 2 : 0
    weight -= Math.abs(actualStep) >= 2 && difficulty === "easy" ? 1 : 0

    return {
      step: actualStep,
      weight: Math.max(0.2, weight),
    }
  })

  return pickWeightedEntry(rng, options).step
}

export interface MelodyGeneratorState {
  currentIndex: number
  lastInterval: number
  phraseBarIndex: number
  phraseLengthBars: number
  contour: PhraseContour
  phraseAnchorIndex: number
  phraseSpan: number
  motifSteps: number[]
  motifCursor: number
  driftDirection: number
  repeatStreak: number
  rhythmPattern?: number[]
}

export function createInitialMelodyState(
  scale: ScaleNote[],
  rng: SeededRandom,
  difficulty: MelodyDifficulty = "easy"
): MelodyGeneratorState {
  return startPhrase(scale, rng, difficulty, chooseStartingIndex(scale, rng))
}

export function createMelodyBar(
  rng: SeededRandom,
  keySignature: KeySignature,
  difficulty: MelodyDifficulty,
  previousState?: MelodyGeneratorState,
  includeAccidentals = false,
  range: { low: number; high: number } = DEFAULT_WRITTEN_RANGE_BY_CLEF.treble
): { events: MelodyEvent[]; state: MelodyGeneratorState } {
  const normalizedRange = range.low <= range.high ? range : { low: range.high, high: range.low }
  const scale = buildScaleRange(keySignature, normalizedRange.low, normalizedRange.high)
  const state = ensurePhraseState(scale, rng, difficulty, previousState)
  const rhythm = chooseRhythmPattern(rng, difficulty, state.rhythmPattern)
  const events: MelodyEvent[] = []
  let beatIndex = 0

  state.rhythmPattern = rhythm

  const isFinalBarOfPhrase = state.phraseBarIndex === state.phraseLengthBars - 1
  const cadenceIndex = chooseCadenceIndex(scale, state.currentIndex)

  for (let noteIndex = 0; noteIndex < rhythm.length; noteIndex++) {
    const durationBeats = rhythm[noteIndex]
    const noteProgress = (state.phraseBarIndex + noteIndex / Math.max(1, rhythm.length)) / state.phraseLengthBars
    const targetIndex = getContourTargetIndex(scale, state, noteProgress)
    const isPenultimateCadenceNote = isFinalBarOfPhrase && noteIndex === rhythm.length - 2
    const isCadenceNote = isFinalBarOfPhrase && noteIndex === rhythm.length - 1

    if (isPenultimateCadenceNote) {
      state.currentIndex = chooseApproachIndex(scale, state.currentIndex, cadenceIndex)
    } else if (isCadenceNote) {
      state.currentIndex = cadenceIndex
    }

    const baseNote = scale[state.currentIndex]
    const accidentalCandidates =
      includeAccidentals && !isCadenceNote && rng.random() < ACCIDENTAL_RATE
        ? [baseNote.midi - 1, baseNote.midi + 1].filter(
            (midi) => midi >= normalizedRange.low && midi <= normalizedRange.high && !isPitchInKeySignature(keySignature, midi)
          )
        : []
    const note =
      accidentalCandidates.length > 0
        ? createScaleNote(keySignature, rng.pick(accidentalCandidates), baseNote.scaleDegreeOffset)
        : baseNote

    events.push({
      beatIndex,
      durationBeats,
      midi: note.midi,
      staffKey: note.staffKey,
      noteName: note.noteName,
      scaleDegreeOffset: note.scaleDegreeOffset,
    })

    if (isCadenceNote) {
      state.lastInterval = 0
      state.repeatStreak = isStableScaleDegree(note.scaleDegreeOffset) ? 0 : state.repeatStreak
    } else {
      const preferredDirection = getPreferredDirection(state, noteProgress)
      const nextStep = pickNextStep(rng, difficulty, state, targetIndex, preferredDirection, scale)
      const nextIndex = clampIndex(state.currentIndex + nextStep, scale.length - 1)

      state.lastInterval = nextIndex - state.currentIndex
      state.repeatStreak = state.lastInterval === 0 ? state.repeatStreak + 1 : 0
      state.currentIndex = nextIndex
      state.motifCursor = (state.motifCursor + 1) % state.motifSteps.length
    }

    beatIndex += durationBeats
  }

  state.phraseBarIndex += 1

  return { events, state }
}

export function buildTransposedMelodyEvent(event: MelodyEvent, concertKey: KeySignature, instrument: InstrumentTransposition): MelodyEvent {
  if (instrument === "concert") {
    return event
  }

  const writtenKey = transposeKeySignature(concertKey, instrument)
  const writtenMidi = transposeMidiForInstrument(event.midi, instrument)
  const writtenNote = createScaleNote(writtenKey, writtenMidi, event.scaleDegreeOffset)

  return {
    ...event,
    midi: writtenNote.midi,
    staffKey: writtenNote.staffKey,
    noteName: writtenNote.noteName,
  }
}
