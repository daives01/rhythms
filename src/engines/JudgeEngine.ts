// JudgeEngine - handles hit detection, miss checking, and game over logic

import type { RuntimeOnset, HitResult } from "@/types"
import { transportEngine } from "./TransportEngine"
import { rhythmBuffer } from "./RhythmEngine"

export type JudgeCallback = (result: HitResult, onset: RuntimeOnset | null, timingError: number) => void
export type GameOverCallback = (reason: "miss" | "extra") => void

export class JudgeEngine {
  private toleranceMs: number = 100 // Default tolerance window
  private earlyWindowMs: number = 300 // How early you can hit and still count
  private onJudgeCallbacks: Set<JudgeCallback> = new Set()
  private onGameOverCallbacks: Set<GameOverCallback> = new Set()
  private missCheckTimer: number | null = null
  private isActive: boolean = false

  setTolerance(toleranceMs: number): void {
    this.toleranceMs = Math.max(50, Math.min(150, toleranceMs))
    // Early window scales with tolerance
    this.earlyWindowMs = this.toleranceMs * 3
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
    const earlyWindowSec = this.earlyWindowMs / 1000
    const unhitOnsets = rhythmBuffer.getUnhitOnsets()

    console.log('🎯 HIT DETECTED at', hitTime.toFixed(3), 's')

    // Find the next unhit onset (could be in the past within tolerance, or upcoming)
    let bestOnset: RuntimeOnset | null = null
    let bestScore = Infinity

    for (const onset of unhitOnsets) {
      const timeDiff = onset.timeSec - hitTime // positive = onset is in future, negative = in past

      // Accept hits that are:
      // - Up to toleranceSec LATE (onset in past)
      // - Up to earlyWindowSec EARLY (onset in future)
      if (timeDiff >= -toleranceSec && timeDiff <= earlyWindowSec) {
        // Score by absolute distance, preferring closer notes
        const score = Math.abs(timeDiff)
        if (score < bestScore) {
          bestScore = score
          bestOnset = onset
        }
      }
    }

    if (bestOnset) {
      // Valid hit - mark it
      rhythmBuffer.markHit(bestOnset.id)
      // Adjust timing: compensate for ~45ms audio/visual latency
      const timingError = (hitTime - bestOnset.timeSec) * 1000 + 45 // negative = early, positive = late
      console.log('✅ MATCHED onset:', {
        expectedTime: bestOnset.timeSec.toFixed(3) + 's',
        actualTime: hitTime.toFixed(3) + 's',
        timingError: timingError.toFixed(1) + 'ms',
        result: timingError < 0 ? 'EARLY' : timingError > 0 ? 'LATE' : 'PERFECT'
      })
      this.notifyJudge("hit", bestOnset, timingError)
    } else {
      // No valid onset found - this is an extra hit
      // Be stricter: penalize if there's no onset coming soon
      const nextOnset = unhitOnsets.find(o => o.timeSec > hitTime)
      if (!nextOnset || (nextOnset.timeSec - hitTime) > 0.5) {
        // Nothing coming for over 500ms - definitely extra
        console.log('❌ EXTRA HIT - no onset found within tolerance')
        this.notifyJudge("extra", null, 0)
        this.triggerGameOver("extra")
      } else {
        console.log('⏩ Too early - next onset at', nextOnset.timeSec.toFixed(3), 's (diff:', ((nextOnset.timeSec - hitTime) * 1000).toFixed(1), 'ms)')
      }
      // Otherwise just ignore the early tap (grace period)
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
          const missedBy = (currentTime - onset.timeSec) * 1000
          console.log('❌ MISS detected:', {
            expectedTime: onset.timeSec.toFixed(3) + 's',
            currentTime: currentTime.toFixed(3) + 's',
            missedBy: missedBy.toFixed(1) + 'ms'
          })
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
