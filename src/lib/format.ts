import type { Difficulty } from "@/types"

export function formatShortDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function formatDifficultyLabel(value?: string | null): string {
  if (!value) return "Any"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export const getDifficultyFromValue = (v: number): Difficulty => {
  if (v < 0.33) return "easy"
  if (v < 0.67) return "medium"
  return "hard"
}

export const calculateBPMColor = (bpm: number): string => {
  const minBpm = 60
  const maxBpm = 180
  const normalized = Math.min(Math.max((bpm - minBpm) / (maxBpm - minBpm), 0), 1)

  if (normalized <= 0.5) {
    const p = normalized / 0.5
    const r = Math.round(52 + p * (251 - 52))
    const g = Math.round(211 + p * (191 - 211))
    const b = Math.round(153 + p * (36 - 153))
    return `rgb(${r}, ${g}, ${b})`
  }

  const p = (normalized - 0.5) / 0.5
  const r = Math.round(251 + p * (248 - 251))
  const g = Math.round(191 + p * (113 - 191))
  const b = Math.round(36 + p * (113 - 36))
  return `rgb(${r}, ${g}, ${b})`
}

export const difficultyValueMap: Record<string, number> = {
  easy: 0,
  medium: 0.5,
  hard: 1,
}
