import type { KeySignature, MelodyPracticeConfig, RuntimeMelodyBar, RuntimeMelodyEvent } from "@/types"
import { SeededRandom } from "@/lib/random"
import {
  buildScaleRange,
  buildTransposedMelodyEvent,
  createInitialMelodyState,
  createMelodyBar,
  getConcertRangeForInstrument,
  midiToFrequency,
} from "@/lib/melody"

let sheetBarId = 0
let sheetEventId = 0

function nextSheetBarId(): string {
  return `melody-sheet-bar-${sheetBarId++}`
}

function nextSheetEventId(): string {
  return `melody-sheet-event-${sheetEventId++}`
}

export function applyInstrumentToRuntimeBars(
  bars: RuntimeMelodyBar[],
  concertKey: KeySignature,
  instrument: MelodyPracticeConfig["instrument"]
): RuntimeMelodyBar[] {
  return bars.map((bar) => ({
    ...bar,
    events: bar.events.map((event) => {
      const displayEvent = buildTransposedMelodyEvent(event, concertKey, instrument)
      return {
        ...event,
        midi: displayEvent.midi,
        staffKey: displayEvent.staffKey,
        noteName: displayEvent.noteName,
        frequency: midiToFrequency(displayEvent.midi),
      }
    }),
  }))
}

export function createFixedMelodyExercise(config: MelodyPracticeConfig): RuntimeMelodyBar[] {
  sheetBarId = 0
  sheetEventId = 0

  const rng = new SeededRandom(config.seed)
  const concertRange = getConcertRangeForInstrument(config.rangeLow, config.rangeHigh, config.instrument)
  const scale = buildScaleRange(config.keySignature, concertRange.low, concertRange.high)
  let state = createInitialMelodyState(scale, rng, config.difficulty)
  const bars: RuntimeMelodyBar[] = []
  const secondsPerBeat = 60 / config.bpm

  for (let barIndex = 0; barIndex < config.exerciseBars; barIndex++) {
    const generated = createMelodyBar(rng, config.keySignature, config.difficulty, state, config.accidentals, concertRange)
    state = generated.state

    const events: RuntimeMelodyEvent[] = generated.events.map((event) => ({
      ...event,
      id: nextSheetEventId(),
      timeSec: barIndex * 4 * secondsPerBeat + event.beatIndex * secondsPerBeat,
      durationSec: event.durationBeats * secondsPerBeat,
      frequency: midiToFrequency(event.midi),
    }))

    bars.push({
      id: nextSheetBarId(),
      barIndex,
      events,
    })
  }

  return bars
}
