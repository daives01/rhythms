import { startTransition, useCallback, useEffect, useRef, useState } from "react"
import {
  analyzePitchFrame,
  midiToNoteName,
  midiToFrequency,
} from "@/lib/pitch-detection"

type PitchStatus = "idle" | "requesting" | "listening" | "denied" | "error"

interface DetectedPitchSnapshot {
  status: PitchStatus
  amplitude: number
  confidence: number
  signalActive: boolean
  stableMidi: number | null
  stableFrequency: number | null
  stableNoteName: string | null
  cents: number | null
  rawMidi: number | null
  rawFrequency: number | null
  error: string | null
}

const DEFAULT_SNAPSHOT: DetectedPitchSnapshot = {
  status: "idle",
  amplitude: 0,
  confidence: 0,
  signalActive: false,
  stableMidi: null,
  stableFrequency: null,
  stableNoteName: null,
  cents: null,
  rawMidi: null,
  rawFrequency: null,
  error: null,
}

const FFT_SIZE = 4096
const AMPLITUDE_THRESHOLD = 0.015
const CLARITY_THRESHOLD = 0.84
const STABLE_WINDOW = 5
const REQUIRED_STABLE_MATCHES = 3

export function usePitchDetection() {
  const [snapshot, setSnapshot] = useState<DetectedPitchSnapshot>(DEFAULT_SNAPSHOT)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timeDomainBufferRef = useRef<Float32Array | null>(null)
  const midiHistoryRef = useRef<number[]>([])

  const stop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }

    analyserRef.current = null
    timeDomainBufferRef.current = null
    midiHistoryRef.current = []
    setSnapshot(DEFAULT_SNAPSHOT)
  }, [])

  function analyze() {
    const analyser = analyserRef.current
    const audioContext = audioContextRef.current
    const buffer = timeDomainBufferRef.current

    if (!analyser || !audioContext || !buffer) return

    analyser.getFloatTimeDomainData(buffer as Float32Array<ArrayBuffer>)
    const frame = analyzePitchFrame(buffer, audioContext.sampleRate)
    const signalActive = frame.amplitude >= AMPLITUDE_THRESHOLD && frame.clarity >= CLARITY_THRESHOLD && frame.midi !== null

    if (signalActive && frame.midi !== null) {
      midiHistoryRef.current.push(frame.midi)
      if (midiHistoryRef.current.length > STABLE_WINDOW) {
        midiHistoryRef.current.shift()
      }
    } else {
      midiHistoryRef.current = []
    }

    const stableMidi = getStableMidi(midiHistoryRef.current)
    const stableFrequency = stableMidi === null ? null : midiToFrequency(stableMidi)

    startTransition(() => {
      setSnapshot({
        status: "listening",
        amplitude: frame.amplitude,
        confidence: frame.clarity,
        signalActive: stableMidi !== null,
        stableMidi,
        stableFrequency,
        stableNoteName: stableMidi === null ? null : midiToNoteName(stableMidi),
        cents: stableMidi === null ? null : frame.cents,
        rawMidi: frame.midi,
        rawFrequency: frame.frequency,
        error: null,
      })
    })

    animationFrameRef.current = requestAnimationFrame(analyze)
  }

  async function start() {
    if (snapshot.status === "requesting" || snapshot.status === "listening") {
      return true
    }

    setSnapshot((current) => ({
      ...current,
      status: "requesting",
      error: null,
    }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      })

      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.15

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser
      sourceRef.current = source
      streamRef.current = stream
      timeDomainBufferRef.current = new Float32Array(analyser.fftSize)
      midiHistoryRef.current = []
      animationFrameRef.current = requestAnimationFrame(analyze)

      setSnapshot((current) => ({
        ...current,
        status: "listening",
        error: null,
      }))

      return true
    } catch (error) {
      const denied = error instanceof DOMException && (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      )

      setSnapshot((current) => ({
        ...current,
        status: denied ? "denied" : "error",
        error: denied ? "Microphone access was denied." : "Microphone setup failed.",
      }))
      return false
    }
  }

  useEffect(() => stop, [stop])

  return {
    snapshot,
    start,
    stop,
  }
}

function getStableMidi(history: number[]): number | null {
  if (history.length < REQUIRED_STABLE_MATCHES) return null

  const counts = new Map<number, number>()
  for (const midi of history) {
    counts.set(midi, (counts.get(midi) ?? 0) + 1)
  }

  let bestMidi: number | null = null
  let bestCount = 0

  counts.forEach((count, midi) => {
    if (count > bestCount) {
      bestCount = count
      bestMidi = midi
    }
  })

  return bestCount >= REQUIRED_STABLE_MATCHES ? bestMidi : null
}
