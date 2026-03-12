import { describe, expect, it } from "bun:test"
import { MelodyJudgeEngine } from "../engines/MelodyJudgeEngine"

describe("MelodyJudgeEngine", () => {
  it("accepts the expected note inside its real-time window", () => {
    const judge = new MelodyJudgeEngine([
      {
        id: "note-1",
        barIndex: 0,
        beatIndex: 0,
        durationBeats: 1,
        midi: 60,
        staffKey: "c/4",
        noteName: "C4",
        scaleDegreeOffset: 0,
        timeSec: 0,
        durationSec: 1,
        frequency: 261.63,
      },
      {
        id: "note-2",
        barIndex: 0,
        beatIndex: 1,
        durationBeats: 1,
        midi: 62,
        staffKey: "d/4",
        noteName: "D4",
        scaleDegreeOffset: 1,
        timeSec: 1,
        durationSec: 1,
        frequency: 293.66,
      },
    ], 60)

    let snapshot = judge.processDetection(64, 0.1)
    expect(snapshot.correctNotes).toBe(0)
    expect(snapshot.wrongDetections).toBe(1)
    expect(snapshot.activeEventId).toBe("note-1")

    snapshot = judge.processDetection(60, 0.2)
    expect(snapshot.correctNotes).toBe(1)
    expect(snapshot.activeEventId).toBe("note-2")
    expect(snapshot.averageResponseMs).toBe(200)

    snapshot = judge.processDetection(62, 1.2)
    expect(snapshot.correctNotes).toBe(2)
    expect(snapshot.isComplete).toBe(true)
    expect(snapshot.completedEventIds).toEqual(["note-1", "note-2"])
  })

  it("fails once the note window expires without a correct pitch", () => {
    const judge = new MelodyJudgeEngine([
      {
        id: "note-1",
        barIndex: 0,
        beatIndex: 0,
        durationBeats: 1,
        midi: 60,
        staffKey: "c/4",
        noteName: "C4",
        scaleDegreeOffset: 0,
        timeSec: 0,
        durationSec: 1,
        frequency: 261.63,
      },
      {
        id: "note-2",
        barIndex: 0,
        beatIndex: 1,
        durationBeats: 1,
        midi: 62,
        staffKey: "d/4",
        noteName: "D4",
        scaleDegreeOffset: 1,
        timeSec: 1,
        durationSec: 1,
        frequency: 293.66,
      },
    ], 60)

    const snapshot = judge.update(0.6)
    expect(snapshot.isGameOver).toBe(true)
    expect(snapshot.missedNotes).toBe(1)
    expect(snapshot.correctNotes).toBe(0)
    expect(snapshot.activeEventId).toBe("note-1")
  })
})
