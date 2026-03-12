import { describe, expect, it } from "bun:test"
import {
  analyzePitchFrame,
  frequencyToMidi,
  midiToNoteName,
} from "../lib/pitch-detection"

function createSineWave(frequency: number, sampleRate: number, length: number): Float32Array {
  const buffer = new Float32Array(length)

  for (let index = 0; index < length; index++) {
    buffer[index] = Math.sin((2 * Math.PI * frequency * index) / sampleRate)
  }

  return buffer
}

describe("pitch detection", () => {
  it("maps concert frequencies to midi note numbers", () => {
    expect(frequencyToMidi(440)).toBe(69)
    expect(midiToNoteName(69)).toBe("A4")
  })

  it("extracts a stable pitch frame from a simple waveform", () => {
    const sampleRate = 44100
    const buffer = createSineWave(261.63, sampleRate, 4096)
    const frame = analyzePitchFrame(buffer, sampleRate)

    expect(frame.midi).toBe(60)
    expect(frame.frequency).not.toBeNull()
    expect(frame.clarity).toBeGreaterThan(0.82)
  })
})
