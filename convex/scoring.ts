/**
 * Shared score calculation used by both the client and server.
 * Keep these in sync — the server validates client-submitted scores
 * against this function (see playHistory.ts).
 */

const difficultyMultipliers: Record<string, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2.5,
}

export const calculateScore = (
  hits: number,
  bpm: number,
  difficulty: string,
  timeSurvived: number
): number => {
  const difficultyBonus = difficultyMultipliers[difficulty] ?? 1
  const timeBonus = Math.max(1, timeSurvived / 10)
  const bpmBonus = bpm / 120
  return Math.round(hits * difficultyBonus * timeBonus * bpmBonus)
}
