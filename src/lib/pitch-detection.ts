const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const

export interface RawPitchMatch {
  frequency: number
  clarity: number
}

export interface PitchFrame {
  amplitude: number
  frequency: number | null
  midi: number | null
  cents: number | null
  clarity: number
}

export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0

  let sum = 0
  for (let index = 0; index < samples.length; index++) {
    sum += samples[index] * samples[index]
  }

  return Math.sqrt(sum / samples.length)
}

export function frequencyToMidi(frequency: number): number {
  return Math.round(69 + 12 * Math.log2(frequency / 440))
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

export function centsOffFromMidi(frequency: number, midi: number): number {
  return Math.round(1200 * Math.log2(frequency / midiToFrequency(midi)))
}

export function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${note}${octave}`
}

export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  minFrequency: number = 65,
  maxFrequency: number = 1047
): RawPitchMatch | null {
  const amplitude = calculateRms(samples)
  if (amplitude < 0.01) return null

  const minLag = Math.max(2, Math.floor(sampleRate / maxFrequency))
  const maxLag = Math.min(samples.length - 1, Math.floor(sampleRate / minFrequency))
  if (maxLag <= minLag) return null

  let bestLag = -1
  let bestCorrelation = 0
  let foundStrongPeak = false
  let previousCorrelation = 1

  for (let lag = minLag; lag <= maxLag; lag++) {
    let difference = 0
    let samplesCompared = 0

    for (let index = 0; index + lag < samples.length; index++) {
      difference += Math.abs(samples[index] - samples[index + lag])
      samplesCompared += 1
    }

    if (samplesCompared === 0) continue
    const normalizedCorrelation = 1 - difference / samplesCompared

    if (normalizedCorrelation > bestCorrelation) {
      bestCorrelation = normalizedCorrelation
      bestLag = lag
    }

    if (normalizedCorrelation > 0.9 && normalizedCorrelation > previousCorrelation) {
      foundStrongPeak = true
    } else if (foundStrongPeak && normalizedCorrelation < previousCorrelation) {
      break
    }

    previousCorrelation = normalizedCorrelation
  }

  if (bestLag === -1 || bestCorrelation < 0.82) {
    return null
  }

  const previousLag = Math.max(minLag, bestLag - 1)
  const nextLag = Math.min(maxLag, bestLag + 1)
  const previous = previousLag === bestLag ? bestCorrelation : correlationAtLag(samples, previousLag)
  const center = bestCorrelation
  const next = nextLag === bestLag ? bestCorrelation : correlationAtLag(samples, nextLag)
  const curvature = previous - 2 * center + next
  const offset = curvature === 0 ? 0 : 0.5 * (previous - next) / curvature
  const refinedLag = bestLag + Math.max(-1, Math.min(1, offset))

  return {
    frequency: sampleRate / refinedLag,
    clarity: Math.max(0, Math.min(1, bestCorrelation)),
  }
}

function correlationAtLag(samples: Float32Array, lag: number): number {
  let difference = 0
  let samplesCompared = 0

  for (let index = 0; index + lag < samples.length; index++) {
    difference += Math.abs(samples[index] - samples[index + lag])
    samplesCompared += 1
  }

  if (samplesCompared === 0) return 0
  return 1 - difference / samplesCompared
}

export function analyzePitchFrame(samples: Float32Array, sampleRate: number): PitchFrame {
  const amplitude = calculateRms(samples)
  const match = detectPitch(samples, sampleRate)

  if (!match) {
    return {
      amplitude,
      frequency: null,
      midi: null,
      cents: null,
      clarity: 0,
    }
  }

  const midi = frequencyToMidi(match.frequency)
  return {
    amplitude,
    frequency: match.frequency,
    midi,
    cents: centsOffFromMidi(match.frequency, midi),
    clarity: match.clarity,
  }
}
