import { describe, expect, it } from "bun:test"
import { decodeMelodyConfig, encodeMelodyConfig } from "../lib/random"

describe("melody config encoding", () => {
  it("round-trips finite melody exercise settings", () => {
    const encoded = encodeMelodyConfig({
      seed: "abc123",
      bpm: 88,
      difficulty: "medium",
      keySignature: "Eb",
      accidentals: true,
      playbackMode: "both",
      melodyVolume: 0.42,
      instrument: "eb",
      clef: "alto",
      rangeLow: 50,
      rangeHigh: 74,
      viewMode: "page",
      sessionMode: "exercise",
      exerciseBars: 16,
    })

    expect(decodeMelodyConfig(encoded)).toEqual({
      seed: "abc123",
      bpm: 88,
      difficulty: "medium",
      keySignature: "Eb",
      accidentals: true,
      playbackMode: "both",
      melodyVolume: 0.42,
      instrument: "eb",
      clef: "alto",
      rangeLow: 50,
      rangeHigh: 74,
      viewMode: "page",
      sessionMode: "exercise",
      exerciseBars: 16,
    })
  })
})
