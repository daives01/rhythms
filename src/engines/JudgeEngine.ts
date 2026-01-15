// JudgeEngine - handles hit detection, miss checking, and game over logic

import type { RuntimeOnset, HitResult } from "@/types"
import { transportEngine } from "./TransportEngine"
import { rhythmBuffer } from "./RhythmEngine"

export type JudgeCallback = (result: HitResult, onset: RuntimeOnset | null, timingError: number) => void
export type GameOverCallback = (reason: "miss" | "extra") => void

export class JudgeEngine {
  private toleranceMs: number = 80 // Default tolerance window
  private onJudgeCallbacks: Set<JudgeCallback> = new Set()
  private onGameOverCallbacks: Set<GameOverCallback> = new Set()
  private missCheckTimer: number | null = null
  private isActive: boolean = false

  setTolerance(toleranceMs: number): void {
    this.toleranceMs = Math.max(30, Math.min(150, toleranceMs))
  }

  getTolerance(): number {
    return this.toleranceMs
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

  // Called when user hits (tap/key)
  onHit(): void {
    if (!this.isActive) return

    const hitTime = transportEngine.now()
    const toleranceSec = this.toleranceMs / 1000
    const unhitOnsets = rhythmBuffer.getUnhitOnsets()

    // Find nearest unhit onset within tolerance
    let nearestOnset: RuntimeOnset | null = null
    let nearestDistance = Infinity

    for (const onset of unhitOnsets) {
      const distance = Math.abs(hitTime - onset.timeSec)
      if (distance < nearestDistance && distance <= toleranceSec) {
        nearestDistance = distance
        nearestOnset = onset
      }
    }

    if (nearestOnset) {
      // Valid hit
      rhythmBuffer.markHit(nearestOnset.id)
      const timingError = (hitTime - nearestOnset.timeSec) * 1000 // in ms
      this.notifyJudge("hit", nearestOnset, timingError)
    } else {
      // Extra hit - game over
      this.notifyJudge("extra", null, 0)
      this.triggerGameOver("extra")
    }
  }

  private startMissCheck(): void {
    const check = () => {
      if (!this.isActive) return

      const currentTime = transportEngine.now()
      const toleranceSec = this.toleranceMs / 1000
      const unhitOnsets = rhythmBuffer.getUnhitOnsets()

      // Check for misses (onset time + tolerance has passed)
      for (const onset of unhitOnsets) {
        if (currentTime > onset.timeSec + toleranceSec) {
          // Missed this onset - game over
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
