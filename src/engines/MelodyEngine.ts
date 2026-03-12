import type {
  InstrumentTransposition,
  KeySignature,
  MelodyBar,
  MelodyDifficulty,
  RuntimeMelodyBar,
  RuntimeMelodyEvent,
} from "@/types"
import { transportEngine } from "./TransportEngine"
import { SeededRandom } from "@/lib/random"
import {
  buildScaleRange,
  createInitialMelodyState,
  createMelodyBar,
  getConcertRangeForInstrument,
  midiToFrequency,
  type MelodyGeneratorState,
} from "@/lib/melody"

let melodyBarIdCounter = 0
let melodyEventIdCounter = 0

function generateMelodyBarId(): string {
  return `melody-bar-${melodyBarIdCounter++}`
}

function generateMelodyEventId(): string {
  return `melody-event-${melodyEventIdCounter++}`
}

function toRuntimeBar(bar: MelodyBar, barIndex: number): RuntimeMelodyBar {
  const events: RuntimeMelodyEvent[] = bar.events.map((event) => {
    const timeSec = transportEngine.positionToTime(barIndex, event.beatIndex)
    const durationSec = transportEngine.getSecondsPerBeat() * event.durationBeats

    return {
      ...event,
      id: generateMelodyEventId(),
      timeSec,
      durationSec,
      frequency: midiToFrequency(event.midi),
    }
  })

  return {
    id: bar.id,
    barIndex,
    events,
  }
}

export class MelodyBuffer {
  private bars: RuntimeMelodyBar[] = []
  private difficulty: MelodyDifficulty = "easy"
  private keySignature: KeySignature = "C"
  private instrument: InstrumentTransposition = "concert"
  private rangeLow = 55
  private rangeHigh = 81
  private accidentals = false
  private nextBarIndex: number = 0
  private rng: SeededRandom | null = null
  private melodyState: MelodyGeneratorState | null = null

  setDifficulty(difficulty: MelodyDifficulty): void {
    this.difficulty = difficulty
  }

  setKeySignature(keySignature: KeySignature): void {
    this.keySignature = keySignature
  }

  setInstrument(instrument: InstrumentTransposition): void {
    this.instrument = instrument
  }

  setWrittenRange(low: number, high: number): void {
    this.rangeLow = low
    this.rangeHigh = high
  }

  setAccidentals(accidentals: boolean): void {
    this.accidentals = accidentals
  }

  reset(): void {
    this.bars = []
    this.nextBarIndex = 0
    this.rng = null
    this.melodyState = null
    melodyBarIdCounter = 0
    melodyEventIdCounter = 0
  }

  initialize(seed: string): RuntimeMelodyBar[] {
    this.reset()
    this.rng = new SeededRandom(seed)
    const concertRange = getConcertRangeForInstrument(this.rangeLow, this.rangeHigh, this.instrument)
    this.melodyState = createInitialMelodyState(buildScaleRange(this.keySignature, concertRange.low, concertRange.high), this.rng, this.difficulty)

    for (let i = 0; i < 8; i++) {
      this.appendBar()
    }

    return this.bars
  }

  appendBar(): RuntimeMelodyBar {
    if (!this.rng) {
      throw new Error("MelodyBuffer must be initialized with a seed before generating bars")
    }

    const { events, state } = createMelodyBar(
      this.rng,
      this.keySignature,
      this.difficulty,
      this.melodyState ?? undefined,
      this.accidentals,
      getConcertRangeForInstrument(this.rangeLow, this.rangeHigh, this.instrument)
    )
    this.melodyState = state

    const runtimeBar = toRuntimeBar({ id: generateMelodyBarId(), events }, this.nextBarIndex)
    this.bars.push(runtimeBar)
    this.nextBarIndex++
    return runtimeBar
  }

  shiftBar(): RuntimeMelodyBar | undefined {
    return this.bars.shift()
  }

  getBars(): RuntimeMelodyBar[] {
    return this.bars
  }

  getEvents(): RuntimeMelodyEvent[] {
    return this.bars.flatMap((bar) => bar.events)
  }

  advanceIfNeeded(currentBarIndex: number): boolean {
    if (this.bars.length === 0) return false

    const firstVisibleBar = this.bars[0].barIndex
    if (currentBarIndex >= firstVisibleBar + 3) {
      this.shiftBar()
      this.appendBar()
      return true
    }

    return false
  }
}

export const melodyBuffer = new MelodyBuffer()
