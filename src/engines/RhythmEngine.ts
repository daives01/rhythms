import type { Bar, Onset, RuntimeBar, RuntimeOnset, Difficulty, BeatPattern } from "@/types"
import { transportEngine } from "./TransportEngine"
import beatsConfig from "@/beats.json"

let barIdCounter = 0
let onsetIdCounter = 0

function generateBarId(): string {
  return `bar-${barIdCounter++}`
}

function generateOnsetId(): string {
  return `onset-${onsetIdCounter++}`
}

const allPatterns = beatsConfig.beats as BeatPattern[]

function getPatternsForDifficulty(difficulty: Difficulty): BeatPattern[] {
  return allPatterns.filter((p) => p.difficulty.includes(difficulty))
}

function pickRandomPattern(patterns: BeatPattern[], targetLength?: 1 | 2): BeatPattern {
  const filtered = targetLength ? patterns.filter((p) => p.length === targetLength) : patterns
  const pool = filtered.length > 0 ? filtered : patterns
  return pool[Math.floor(Math.random() * pool.length)]
}

// Calculate "complexity" of a bar based on number of onsets and syncopation
export function calculateBarComplexity(bar: Bar): number {
  const numOnsets = bar.onsets.length
  let syncopation = 0

  for (const onset of bar.onsets) {
    // Offbeat sixteenths (n=1 or n=3) are more complex
    if (onset.n % 2 === 1) syncopation++
    // Offbeat eighths (n=2) are slightly less complex
    else if (onset.n === 2) syncopation += 0.5
  }

  return numOnsets + syncopation
}

export function generateBar(difficulty: Difficulty, isFirstBar: boolean = false): Bar {
  const patterns = getPatternsForDifficulty(difficulty)
  const onsets: Onset[] = []

  let beatsRemaining = 4
  let currentBeat = 0

  // For first bar, skip beat 0
  if (isFirstBar) {
    beatsRemaining = 3
    currentBeat = 1
  }

  while (beatsRemaining > 0) {
    // If we have 3 beats left, randomly choose 1 or 2 beat pattern
    // If we have 2 or 4 beats left, can use either 1 or 2
    // If we have 1 beat left, must use 1
    let targetLength: 1 | 2
    if (beatsRemaining === 1) {
      targetLength = 1
    } else if (beatsRemaining === 3) {
      // Can't fit a 2-beat, so alternate: 1+2 or 2+1
      targetLength = Math.random() < 0.5 ? 1 : 2
      // But if we pick 2 first with 3 remaining, we'd have 1 left - that works
      // Actually just pick based on what's available
      targetLength = Math.random() < 0.5 ? 1 : (beatsRemaining >= 2 ? 2 : 1)
    } else {
      // 2 or 4 beats remaining - randomly pick 1 or 2
      targetLength = Math.random() < 0.5 ? 1 : 2
    }

    // Make sure target doesn't exceed remaining
    if (targetLength > beatsRemaining) {
      targetLength = beatsRemaining as 1 | 2
    }

    const pattern = pickRandomPattern(patterns, targetLength)

    // Convert pattern onsets to bar onsets
    for (const pOnset of pattern.onsets) {
      // pOnset.n is the slot within the pattern (0-3 for 1-beat, 0-7 for 2-beat)
      const slotInBar = currentBeat * 4 + pOnset.n
      const beatIndex = Math.floor(slotInBar / 4) as 0 | 1 | 2 | 3
      const n = slotInBar % 4

      onsets.push({
        beatIndex,
        n,
        d: 4,
      })
    }

    currentBeat += pattern.length
    beatsRemaining -= pattern.length
  }

  // Sort onsets by position
  onsets.sort((a, b) => {
    const aIdx = a.beatIndex * 4 + a.n
    const bIdx = b.beatIndex * 4 + b.n
    return aIdx - bIdx
  })

  return {
    id: generateBarId(),
    onsets,
  }
}

export function toRuntimeBar(bar: Bar, barIndex: number): RuntimeBar {
  const onsets: RuntimeOnset[] = bar.onsets.map((onset) => ({
    id: generateOnsetId(),
    timeSec: transportEngine.positionToTime(barIndex, onset.beatIndex, onset.n, onset.d),
    hit: false,
    beatIndex: onset.beatIndex,
    n: onset.n,
    d: onset.d,
  }))

  return {
    id: bar.id,
    barIndex,
    onsets,
  }
}

export class RhythmBuffer {
  private bars: RuntimeBar[] = []
  private difficulty: Difficulty = "medium"
  private nextBarIndex: number = 0

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty
  }

  reset(): void {
    this.bars = []
    this.nextBarIndex = 0
    barIdCounter = 0
    onsetIdCounter = 0
  }

  initialize(): RuntimeBar[] {
    this.reset()
    // Initialize with 6 bars (extra lookahead to prevent pop-in)
    for (let i = 0; i < 6; i++) {
      this.appendBar(i === 0)
    }
    return this.bars
  }

  appendBar(isFirstBar: boolean = false): RuntimeBar {
    const bar = generateBar(this.difficulty, isFirstBar)
    const runtimeBar = toRuntimeBar(bar, this.nextBarIndex)
    this.bars.push(runtimeBar)
    this.nextBarIndex++
    return runtimeBar
  }

  shiftBar(): RuntimeBar | undefined {
    return this.bars.shift()
  }

  getBars(): RuntimeBar[] {
    return this.bars
  }

  getUnhitOnsets(): RuntimeOnset[] {
    return this.bars.flatMap((bar) => bar.onsets.filter((o) => !o.hit))
  }

  markHit(onsetId: string): boolean {
    for (const bar of this.bars) {
      const onset = bar.onsets.find((o) => o.id === onsetId)
      if (onset) {
        onset.hit = true
        return true
      }
    }
    return false
  }

  advanceIfNeeded(currentBarIndex: number): boolean {
    if (this.bars.length === 0) return false

    const firstVisibleBar = this.bars[0].barIndex

    // Sliding window: keep 1 bar behind and 1 bar ahead
    // When current bar is 2 past the first visible bar, shift one and append one
    if (currentBarIndex >= firstVisibleBar + 2) {
      this.shiftBar()
      this.appendBar()
      return true
    }

    return false
  }
}

export const rhythmBuffer = new RhythmBuffer()
