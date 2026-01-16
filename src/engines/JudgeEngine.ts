import type { RuntimeOnset, HitResult } from "@/types"
import { transportEngine } from "./TransportEngine"
import { rhythmBuffer } from "./RhythmEngine"

export type JudgeCallback = (result: HitResult, onset: RuntimeOnset | null, timingError: number) => void
export type GameOverCallback = (reason: "miss" | "extra") => void

export class JudgeEngine {
  private toleranceMs: number = 100
  private earlyWindowMs: number = 300
  private latencyOffsetMs: number = 0
  private onJudgeCallbacks: Set<JudgeCallback> = new Set()
  private onGameOverCallbacks: Set<GameOverCallback> = new Set()
  private missCheckTimer: number | null = null
  private isActive: boolean = false

  setTolerance(toleranceMs: number): void {
    this.toleranceMs = Math.max(50, Math.min(150, toleranceMs))
    this.earlyWindowMs = this.toleranceMs * 3
  }

  getTolerance(): number {
    return this.toleranceMs
  }

  setLatencyOffset(offsetMs: number): void {
    this.latencyOffsetMs = offsetMs
  }

  getLatencyOffset(): number {
    return this.latencyOffsetMs
  }

  onJudge(callback: JudgeCallback): () => void {
    this.onJudgeCallbacks.add(callback)
    return () => this.onJudgeCallbacks.delete(callback)
  }

  onGameOver(callback: GameOverCallback): () => void {
    this.onGameOverCallbacks.add(callback)
    return () => this.onGameOverCallbacks.delete(callback)
  }

  start(): void {
    this.isActive = true
    this.startMissCheck()
  }

  stop(): void {
    this.isActive = false
    if (this.missCheckTimer !== null) {
      cancelAnimationFrame(this.missCheckTimer)
      this.missCheckTimer = null
    }
  }

  onHit(): void {
    if (!this.isActive) return

    const rawHitTime = transportEngine.now()
    const hitTime = rawHitTime - this.latencyOffsetMs / 1000
    const toleranceSec = this.toleranceMs / 1000
    const earlyWindowSec = this.earlyWindowMs / 1000
    const unhitOnsets = rhythmBuffer.getUnhitOnsets()

    let bestOnset: RuntimeOnset | null = null
    let bestScore = Infinity

    for (const onset of unhitOnsets) {
      const timeDiff = onset.timeSec - hitTime

      if (timeDiff >= -toleranceSec && timeDiff <= earlyWindowSec) {
        const score = Math.abs(timeDiff)
        if (score < bestScore) {
          bestScore = score
          bestOnset = onset
        }
      }
    }

    if (bestOnset) {
      rhythmBuffer.markHit(bestOnset.id)
      const timingError = (hitTime - bestOnset.timeSec) * 1000
      this.notifyJudge("hit", bestOnset, timingError)
    } else {
      const nextOnset = unhitOnsets.find(o => o.timeSec > hitTime)
      if (!nextOnset || (nextOnset.timeSec - hitTime) > 0.5) {
        this.notifyJudge("extra", null, 0)
        this.triggerGameOver("extra")
      }
    }
  }

  private startMissCheck(): void {
    const check = () => {
      if (!this.isActive) return

      const rawTime = transportEngine.now()
      const adjustedTime = rawTime - this.latencyOffsetMs / 1000
      const toleranceSec = this.toleranceMs / 1000
      const unhitOnsets = rhythmBuffer.getUnhitOnsets()

      for (const onset of unhitOnsets) {
        if (adjustedTime > onset.timeSec + toleranceSec) {
          this.notifyJudge("miss", onset, 0)
          this.triggerGameOver("miss")
          return
        }
      }

      this.missCheckTimer = requestAnimationFrame(check)
    }

    this.missCheckTimer = requestAnimationFrame(check)
  }

  private notifyJudge(result: HitResult, onset: RuntimeOnset | null, timingError: number): void {
    this.onJudgeCallbacks.forEach((cb) => cb(result, onset, timingError))
  }

  private triggerGameOver(reason: "miss" | "extra"): void {
    this.stop()
    this.onGameOverCallbacks.forEach((cb) => cb(reason))
  }
}

export const judgeEngine = new JudgeEngine()
