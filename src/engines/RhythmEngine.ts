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
interface DifficultySettings {
  minOnsetsPerBar: number
  maxOnsetsPerBar: number
  downbeatWeight: number // Weight for beat 0 positions (n=0)
  offbeatWeight: number // Weight for off-beat positions (n=1,2,3)
  maxConsecutive: number // Max consecutive 16th notes
}

const DIFFICULTY_PRESETS: Record<number, DifficultySettings> = {
  1: { minOnsetsPerBar: 4, maxOnsetsPerBar: 6, downbeatWeight: 4, offbeatWeight: 1, maxConsecutive: 2 },
  2: { minOnsetsPerBar: 5, maxOnsetsPerBar: 8, downbeatWeight: 3, offbeatWeight: 1.5, maxConsecutive: 3 },
  3: { minOnsetsPerBar: 6, maxOnsetsPerBar: 10, downbeatWeight: 2, offbeatWeight: 2, maxConsecutive: 4 },
  4: { minOnsetsPerBar: 8, maxOnsetsPerBar: 12, downbeatWeight: 1.5, offbeatWeight: 2.5, maxConsecutive: 5 },
  5: { minOnsetsPerBar: 10, maxOnsetsPerBar: 16, downbeatWeight: 1, offbeatWeight: 3, maxConsecutive: 8 },
}

function getDifficultySettings(difficulty: number): DifficultySettings {
  return DIFFICULTY_PRESETS[Math.max(1, Math.min(5, Math.round(difficulty)))] ?? DIFFICULTY_PRESETS[2]
}

// Generate a single bar of rhythm (16ths only for MVP)
export function generateBar(difficulty: number): Bar {
  const settings = getDifficultySettings(difficulty)
  const targetOnsets = Math.floor(
    Math.random() * (settings.maxOnsetsPerBar - settings.minOnsetsPerBar + 1) + settings.minOnsetsPerBar
  )

  // All possible 16th positions in a bar (16 total)
  const positions: Array<{ beatIndex: 0 | 1 | 2 | 3; n: number }> = []
  for (let beatIndex = 0; beatIndex < 4; beatIndex++) {
    for (let n = 0; n < 4; n++) {
      positions.push({ beatIndex: beatIndex as 0 | 1 | 2 | 3, n })
    }
  }

  // Calculate weights for each position
  const weights = positions.map((pos) => {
    return pos.n === 0 ? settings.downbeatWeight : settings.offbeatWeight
  })

  // Select positions using weighted random sampling
  const selected: Onset[] = []
  const available = [...positions]
  const availableWeights = [...weights]

  // Always include at least one downbeat for readability
  const firstDownbeat = Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3
  selected.push({ beatIndex: firstDownbeat, n: 0, d: 4 })
  const firstDownbeatIdx = available.findIndex(
    (p) => p.beatIndex === firstDownbeat && p.n === 0
  )
  available.splice(firstDownbeatIdx, 1)
  availableWeights.splice(firstDownbeatIdx, 1)

  // Fill remaining slots
  while (selected.length < targetOnsets && available.length > 0) {
    const totalWeight = availableWeights.reduce((a, b) => a + b, 0)
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

    // Check consecutive constraint
    const sixteenthIndex = pos.beatIndex * 4 + pos.n
    const hasConsecutive = selected.some((s) => {
      const idx = s.beatIndex * 4 + s.n
      return Math.abs(idx - sixteenthIndex) === 1
    })

    // Count current consecutive run
    if (hasConsecutive) {
      const consecutiveCount = countConsecutive(selected, sixteenthIndex)
      if (consecutiveCount >= settings.maxConsecutive) {
        available.splice(selectedIdx, 1)
        availableWeights.splice(selectedIdx, 1)
        continue
      }
    }

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

function countConsecutive(onsets: Onset[], newIndex: number): number {
  const indices = new Set(onsets.map((o) => o.beatIndex * 4 + o.n))
  indices.add(newIndex)

  let maxRun = 0
  let currentRun = 0
  for (let i = 0; i < 16; i++) {
    if (indices.has(i)) {
      currentRun++
      maxRun = Math.max(maxRun, currentRun)
    } else {
      currentRun = 0
    }
  }

  return maxRun
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
    this.difficulty = Math.max(1, Math.min(5, difficulty))
  }

  reset(): void {
    this.bars = []
    this.nextBarIndex = 0
    barIdCounter = 0
    onsetIdCounter = 0
  }

  // Initialize with 4 bars
  initialize(): RuntimeBar[] {
    this.reset()
    for (let i = 0; i < 4; i++) {
      this.appendBar()
    }
    return this.bars
  }

  // Append a new bar and return updated buffer
  appendBar(): RuntimeBar {
    const bar = generateBar(this.difficulty)
    const runtimeBar = toRuntimeBar(bar, this.nextBarIndex)
    this.bars.push(runtimeBar)
    this.nextBarIndex++
    return runtimeBar
  }

  // Remove oldest bar (when scrolling)
  shiftBar(): RuntimeBar | undefined {
    return this.bars.shift()
  }

  // Get current visible bars
  getBars(): RuntimeBar[] {
    return this.bars
  }

  // Get all unhit onsets across all bars
  getUnhitOnsets(): RuntimeOnset[] {
    return this.bars.flatMap((bar) => bar.onsets.filter((o) => !o.hit))
  }

  // Mark an onset as hit by ID
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

  // Advance the buffer if needed (call this when playhead moves)
  // Returns true if buffer was advanced
  advanceIfNeeded(currentBarIndex: number): boolean {
    if (this.bars.length === 0) return false

    // When we're in bar 2 of visible (index 2 relative to first visible),
    // we should add a new bar and drop the oldest
    const firstVisibleBar = this.bars[0].barIndex
    const relativeBar = currentBarIndex - firstVisibleBar

    if (relativeBar >= 2 && this.bars.length <= 4) {
      this.appendBar()
      if (this.bars.length > 4) {
        this.shiftBar()
      }
      return true
    }

    return false
  }
}

export const rhythmBuffer = new RhythmBuffer()
