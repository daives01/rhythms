import type { Bar, Onset, RuntimeBar, RuntimeOnset, Difficulty, BeatPattern } from "@/types"
import { transportEngine } from "./TransportEngine"
import beatsConfig from "@/beats.json"
import { SeededRandom } from "@/lib/random"

let barIdCounter = 0
let onsetIdCounter = 0

function generateBarId(): string {
  return `bar-${barIdCounter++}`
}

function generateOnsetId(): string {
  return `onset-${onsetIdCounter++}`
}

const allPatterns = beatsConfig.beats as BeatPattern[]

function getPatternsForDifficulty(difficulty: Difficulty, includeTuplets: boolean): BeatPattern[] {
  return allPatterns.filter((p) => {
    if (!p.difficulty.includes(difficulty)) return false
    if (!includeTuplets && p.tuplet) return false
    return true
  })
}

function pickRandomPattern(patterns: BeatPattern[], rng: SeededRandom, targetLength?: 1 | 2): BeatPattern {
  const filtered = targetLength ? patterns.filter((p) => p.length === targetLength) : patterns
  const pool = filtered.length > 0 ? filtered : patterns
  return rng.pick(pool)
}

function generateBar(difficulty: Difficulty, rng: SeededRandom, isFirstBar: boolean = false, includeTuplets: boolean = false): Bar {
  const patterns = getPatternsForDifficulty(difficulty, includeTuplets)
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
      targetLength = rng.random() < 0.5 ? 1 : 2
      // But if we pick 2 first with 3 remaining, we'd have 1 left - that works
      // Actually just pick based on what's available
      targetLength = rng.random() < 0.5 ? 1 : (beatsRemaining >= 2 ? 2 : 1)
    } else {
      // 2 or 4 beats remaining - randomly pick 1 or 2
      targetLength = rng.random() < 0.5 ? 1 : 2
    }

    // Make sure target doesn't exceed remaining
    if (targetLength > beatsRemaining) {
      targetLength = beatsRemaining as 1 | 2
    }

    const pattern = pickRandomPattern(patterns, rng, targetLength)

    // Convert pattern onsets to bar onsets
    for (const pOnset of pattern.onsets) {
      // For tuplets, d != 4. pOnset.n is slot within the tuplet subdivision
      // E.g., for triplets: d=3, n=0,1,2 within each beat
      // For 2-beat patterns with d=3: n goes 0-5 (3 per beat * 2 beats)
      const slotsPerBeat = pOnset.d  // 3 for triplets, 4 for regular, 5 for quintuplets
      const beatOffset = Math.floor(pOnset.n / slotsPerBeat)
      const beatIndex = (currentBeat + beatOffset) as 0 | 1 | 2 | 3
      const n = pOnset.n % slotsPerBeat

      onsets.push({
        beatIndex,
        n,
        d: pOnset.d,
        tuplet: pattern.tuplet,
      })
    }

    currentBeat += pattern.length
    beatsRemaining -= pattern.length
  }

  // Sort onsets by position (normalize to common denominator for comparison)
  onsets.sort((a, b) => {
    const aPos = a.beatIndex + a.n / a.d
    const bPos = b.beatIndex + b.n / b.d
    return aPos - bPos
  })

  return {
    id: generateBarId(),
    onsets,
  }
}

function toRuntimeBar(bar: Bar, barIndex: number): RuntimeBar {
  const onsets: RuntimeOnset[] = bar.onsets.map((onset) => ({
    id: generateOnsetId(),
    timeSec: transportEngine.positionToTime(barIndex, onset.beatIndex, onset.n, onset.d),
    hit: false,
    beatIndex: onset.beatIndex,
    n: onset.n,
    d: onset.d,
    tuplet: onset.tuplet,
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
  private includeTuplets: boolean = false
  private nextBarIndex: number = 0
  private rng: SeededRandom | null = null

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty
  }

  setIncludeTuplets(include: boolean): void {
    this.includeTuplets = include
  }

  setSeed(seed: string): void {
    this.rng = new SeededRandom(seed)
  }

  reset(): void {
    this.bars = []
    this.nextBarIndex = 0
    barIdCounter = 0
    onsetIdCounter = 0
  }

  initialize(seed: string): RuntimeBar[] {
    this.reset()
    this.rng = new SeededRandom(seed)
    // Initialize with 6 bars (extra lookahead to prevent pop-in)
    for (let i = 0; i < 6; i++) {
      this.appendBar(i === 0)
    }
    return this.bars
  }

  appendBar(isFirstBar: boolean = false): RuntimeBar {
    if (!this.rng) {
      throw new Error("RhythmBuffer must be initialized with a seed before generating bars")
    }
    const bar = generateBar(this.difficulty, this.rng, isFirstBar, this.includeTuplets)
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
