import { describe, expect, it } from "bun:test"
import { SeededRandom } from "../lib/random"
import {
  buildScaleRange,
  buildTransposedMelodyEvent,
  createInitialMelodyState,
  createMelodyBar,
  getConcertRangeForInstrument,
  normalizeWrittenRange,
  transposeKeySignature,
} from "../lib/melody"

function buildPitchClassSet(key: Parameters<typeof buildScaleRange>[0]): Set<number> {
  return new Set(buildScaleRange(key).map((note) => ((note.midi % 12) + 12) % 12))
}

describe("melody helpers", () => {
  it("builds in-key note collections for flat and sharp keys", () => {
    const gMajor = buildScaleRange("G")
    const ebMajor = buildScaleRange("Eb")

    expect(gMajor.some((note) => note.staffKey.startsWith("f#/"))).toBe(true)
    expect(gMajor.some((note) => note.staffKey.startsWith("f/"))).toBe(false)
    expect(ebMajor.some((note) => note.staffKey.startsWith("ab/"))).toBe(true)
    expect(ebMajor.some((note) => note.staffKey.startsWith("a/"))).toBe(false)
  })

  it("generates deterministic, bar-complete melodic material", () => {
    const rngA = new SeededRandom("melody-seed")
    const rngB = new SeededRandom("melody-seed")
    const barA = createMelodyBar(rngA, "D", "medium")
    const barB = createMelodyBar(rngB, "D", "medium")

    expect(barA.events).toEqual(barB.events)
    expect(barA.events.reduce((sum, event) => sum + event.durationBeats, 0)).toBe(4)
    expect(barA.events.every((event) => event.durationBeats === 0.5 || event.durationBeats === 1 || event.durationBeats === 2)).toBe(true)
  })

  it("can inject notes outside the key signature when accidentals are enabled", () => {
    const inKeyPitchClasses = buildPitchClassSet("C")
    const rng = new SeededRandom("accidental-seed")
    let state = undefined
    const generatedEvents = []

    for (let index = 0; index < 8; index++) {
      const bar = createMelodyBar(rng, "C", "medium", state, true)
      state = bar.state
      generatedEvents.push(...bar.events)
    }

    expect(generatedEvents.some((event) => !inKeyPitchClasses.has(((event.midi % 12) + 12) % 12))).toBe(true)
  })

  it("keeps generated notes inside the requested range", () => {
    const range = { low: 60, high: 72 }
    const rng = new SeededRandom("range-seed")
    let state = createInitialMelodyState(buildScaleRange("C", range.low, range.high), rng, "medium")

    for (let index = 0; index < 6; index++) {
      const bar = createMelodyBar(rng, "C", "medium", state, true, range)
      state = bar.state

      expect(bar.events.every((event) => event.midi >= range.low && event.midi <= range.high)).toBe(true)
    }
  })

  it("maps concert melodies into the selected instrument key", () => {
    const rng = new SeededRandom("transpose-seed")
    const bar = createMelodyBar(rng, "C", "easy", undefined, true)
    const written = buildTransposedMelodyEvent(bar.events[0], "C", "bb")

    expect(transposeKeySignature("C", "bb")).toBe("D")
    expect(written.staffKey).not.toBe(bar.events[0].staffKey)
    expect(written.scaleDegreeOffset).toBe(bar.events[0].scaleDegreeOffset)
  })

  it("converts a written range back to concert pitch for transposing instruments", () => {
    expect(getConcertRangeForInstrument(60, 72, "bb")).toEqual({ low: 58, high: 70 })
    expect(getConcertRangeForInstrument(48, 72, "eb")).toEqual({ low: 39, high: 63 })
  })

  it("enforces at least one octave for written ranges", () => {
    expect(normalizeWrittenRange(60, 60)).toEqual({ low: 60, high: 72 })
    expect(normalizeWrittenRange(88, 93)).toEqual({ low: 81, high: 93 })
  })

  it("ends phrases on stable scale degrees", () => {
    const rng = new SeededRandom("cadence-seed")
    let state = createInitialMelodyState(buildScaleRange("C"), rng, "medium")
    const phraseEndingDegrees: number[] = []

    for (let index = 0; index < 8; index++) {
      const bar = createMelodyBar(rng, "C", "medium", state, false)
      state = bar.state

      if (state.phraseBarIndex === state.phraseLengthBars) {
        const endingDegree = ((bar.events[bar.events.length - 1].scaleDegreeOffset % 7) + 7) % 7
        phraseEndingDegrees.push(endingDegree)
      }
    }

    expect(phraseEndingDegrees.length).toBeGreaterThan(1)
    expect(phraseEndingDegrees.every((degree) => [0, 2, 4].includes(degree))).toBe(true)
  })

  it("reuses interval cells within a phrase instead of wandering note to note", () => {
    const rng = new SeededRandom("motif-seed")
    let state = createInitialMelodyState(buildScaleRange("D"), rng, "medium")
    const intervals: number[] = []

    for (let barIndex = 0; barIndex < 4; barIndex++) {
      const bar = createMelodyBar(rng, "D", "medium", state, false)
      state = bar.state

      const degrees = bar.events.map((event) => event.scaleDegreeOffset)
      for (let index = 1; index < degrees.length; index++) {
        intervals.push(degrees[index] - degrees[index - 1])
      }
    }

    const repeatedBigrams = new Map<string, number>()
    for (let index = 0; index < intervals.length - 1; index++) {
      const bigram = `${intervals[index]},${intervals[index + 1]}`
      repeatedBigrams.set(bigram, (repeatedBigrams.get(bigram) ?? 0) + 1)
    }

    expect([...repeatedBigrams.values()].some((count) => count >= 2)).toBe(true)
  })
})
