import { getDefaultWrittenRange } from "@/lib/melody"
import type { InstrumentTransposition, KeySignature, MelodyClef, MelodyLayoutMode } from "@/types"

const SETTINGS_KEY = "rhythm-settings"
const MELODY_SETTINGS_KEY = "melody-settings"
const LATENCY_OFFSET_KEY = "rhythm-latency-offset"

export interface StoredSettings {
  bpm: number
  difficultyValue: number
  playAlongVolume: number
  groupMode: boolean
  includeTuplets: boolean
}

export interface MelodyStoredSettings {
  bpm: number
  difficultyValue: number
  keySignature: KeySignature
  accidentals: boolean
  melodyVolume: number
  micEnabled: boolean
  instrument: InstrumentTransposition
  clef: MelodyClef
  rangeLow: number
  rangeHigh: number
  viewMode: MelodyLayoutMode
  exerciseBars: number
}

const defaultTrebleRange = getDefaultWrittenRange("treble")

export const DEFAULT_SETTINGS: StoredSettings = {
  bpm: 120,
  difficultyValue: 0,
  playAlongVolume: 0.5,
  groupMode: false,
  includeTuplets: false,
}

export const DEFAULT_MELODY_SETTINGS: MelodyStoredSettings = {
  bpm: 92,
  difficultyValue: 0,
  keySignature: "C",
  accidentals: false,
  melodyVolume: 0.55,
  micEnabled: false,
  instrument: "concert",
  clef: "treble",
  rangeLow: defaultTrebleRange.low,
  rangeHigh: defaultTrebleRange.high,
  viewMode: "live",
  exerciseBars: 16,
}

export function loadSettings(): StoredSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (!stored) return DEFAULT_SETTINGS
    const parsed = JSON.parse(stored)
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Partial<StoredSettings>): void {
  try {
    const current = loadSettings()
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }))
  } catch {
    // ignore
  }
}

export function loadMelodySettings(): MelodyStoredSettings {
  try {
    const stored = localStorage.getItem(MELODY_SETTINGS_KEY)
    if (!stored) return DEFAULT_MELODY_SETTINGS
    const parsed = JSON.parse(stored)
    return { ...DEFAULT_MELODY_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_MELODY_SETTINGS
  }
}

export function saveMelodySettings(settings: Partial<MelodyStoredSettings>): void {
  try {
    const current = loadMelodySettings()
    localStorage.setItem(MELODY_SETTINGS_KEY, JSON.stringify({ ...current, ...settings }))
  } catch {
    // ignore
  }
}

export function hasCalibrated(): boolean {
  try {
    return localStorage.getItem(LATENCY_OFFSET_KEY) !== null
  } catch {
    return false
  }
}

export { SETTINGS_KEY, MELODY_SETTINGS_KEY, LATENCY_OFFSET_KEY }
