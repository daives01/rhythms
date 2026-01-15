// RhythmEngine - generates bars of rhythm based on difficulty
// Maintains a rolling 4-bar buffer

import type { Bar, Onset, RuntimeBar, RuntimeOnset } from "@/types"
import { transportEngine } from "./TransportEngine"

let barIdCounter = 0
let onsetIdCounter = 0

function generateBarId(): string {
  return `bar-${barIdCounter++}`
}

function generateOnsetId(): string {
  return `onset-${onsetIdCounter++}`
}

// Difficulty settings
// Position within beat: 0=downbeat, 1=e (on-beat 16th), 2=& (off-beat 8th), 3=a (off-beat 16th)
interface DifficultySettings {
  allowedPositions: number[] // Which 16th positions within a beat are allowed
  minOnsetsPerBar: number
  maxOnsetsPerBar: number
  downbeatWeight: number // Weight for position 0
}

const DIFFICULTY_PRESETS: Record<number, DifficultySettings> = {
  // Easy: quarters and on-beat eighths only (positions 0, 2)
  1: {
    allowedPositions: [0, 2],
    minOnsetsPerBar: 3,
    maxOnsetsPerBar: 5,
    downbeatWeight: 3,
  },
  // Normal: add on-beat 16ths (position 1)
  2: {
    allowedPositions: [0, 1, 2],
    minOnsetsPerBar: 4,
    maxOnsetsPerBar: 7,
    downbeatWeight: 2,
  },
  // Hard: full 16th grid
  3: {
    allowedPositions: [0, 1, 2, 3],
    minOnsetsPerBar: 5,
    maxOnsetsPerBar: 10,
    downbeatWeight: 1.5,
  },
}

function getDifficultySettings(difficulty: number): DifficultySettings {
  const level = Math.max(1, Math.min(3, Math.round(difficulty)))
  return DIFFICULTY_PRESETS[level] ?? DIFFICULTY_PRESETS[2]
}

// Generate a single bar of rhythm
// isFirstBar: if true, don't place notes at beat 0 (give player reaction time)
export function generateBar(difficulty: number, isFirstBar: boolean = false): Bar {
  const settings = getDifficultySettings(difficulty)
  const targetOnsets = Math.floor(
    Math.random() * (settings.maxOnsetsPerBar - settings.minOnsetsPerBar + 1) + settings.minOnsetsPerBar
  )

  // Build list of allowed positions based on difficulty
  const positions: Array<{ beatIndex: 0 | 1 | 2 | 3; n: number }> = []
  for (let beatIndex = 0; beatIndex < 4; beatIndex++) {
    // Skip beat 0 entirely for first bar (reaction time)
    if (isFirstBar && beatIndex === 0) continue

    for (const n of settings.allowedPositions) {
      positions.push({ beatIndex: beatIndex as 0 | 1 | 2 | 3, n })
    }
  }

  // Calculate weights - downbeats get more weight
  const weights = positions.map((pos) => {
    return pos.n === 0 ? settings.downbeatWeight : 1
  })

  // Select positions using weighted random sampling
  const selected: Onset[] = []
  const available = [...positions]
  const availableWeights = [...weights]

  // Always include at least one downbeat per bar for readability
  const downbeatOptions = positions
    .filter(p => p.n === 0)
    .map(p => p.beatIndex)

  if (downbeatOptions.length > 0) {
    const firstDownbeat = downbeatOptions[Math.floor(Math.random() * downbeatOptions.length)]
    selected.push({ beatIndex: firstDownbeat as 0 | 1 | 2 | 3, n: 0, d: 4 })

    const idx = available.findIndex(p => p.beatIndex === firstDownbeat && p.n === 0)
    if (idx >= 0) {
      available.splice(idx, 1)
      availableWeights.splice(idx, 1)
    }
  }

  // Fill remaining slots
  while (selected.length < targetOnsets && available.length > 0) {
    const totalWeight = availableWeights.reduce((a, b) => a + b, 0)
    if (totalWeight === 0) break

    let random = Math.random() * totalWeight
    let selectedIdx = 0

    for (let i = 0; i < availableWeights.length; i++) {
      random -= availableWeights[i]
      if (random <= 0) {
        selectedIdx = i
        break
      }
    }

    const pos = available[selectedIdx]
    selected.push({ beatIndex: pos.beatIndex, n: pos.n, d: 4 })
    available.splice(selectedIdx, 1)
    availableWeights.splice(selectedIdx, 1)
  }

  // Sort by position
  selected.sort((a, b) => {
    const aIdx = a.beatIndex * 4 + a.n
    const bIdx = b.beatIndex * 4 + b.n
    return aIdx - bIdx
  })

  return {
    id: generateBarId(),
    onsets: selected,
  }
}

// Convert a Bar to RuntimeBar with absolute timing
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

// Rhythm buffer manager
export class RhythmBuffer {
  private bars: RuntimeBar[] = []
  private difficulty: number = 2
  private nextBarIndex: number = 0

  setDifficulty(difficulty: number): void {
    this.difficulty = Math.max(1, Math.min(3, difficulty))
  }

  reset(): void {
    this.bars = []
    this.nextBarIndex = 0
    barIdCounter = 0
    onsetIdCounter = 0
  }

  initialize(): RuntimeBar[] {
    this.reset()
    // Buffer 8 bars: 4 visible + 4 upcoming for smooth page flip
    for (let i = 0; i < 8; i++) {
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

    // Page flip: when we've completed 4 bars, swap to next 4
    // We keep 8 bars buffered (4 visible + 4 upcoming)
    if (currentBarIndex >= firstVisibleBar + 4) {
      // Shift out the 4 completed bars
      for (let i = 0; i < 4 && this.bars.length > 0; i++) {
        this.shiftBar()
      }
      // Append 4 more bars to maintain buffer of 8
      for (let i = 0; i < 4; i++) {
        this.appendBar()
      }
      return true
    }

    return false
  }
}

export const rhythmBuffer = new RhythmBuffer()
