import type { RuntimeOnset, HitResult } from "@/types"
import { transportEngine } from "./TransportEngine"
import { rhythmBuffer } from "./RhythmEngine"

type JudgeCallback = (result: HitResult, onset: RuntimeOnset | null, timingError: number) => void
type GameOverCallback = (reason: "miss" | "extra") => void

export class JudgeEngine {
  private baseToleranceMs: number = 100
  private bpm: number = 120
  private latencyOffsetMs: number = 0
  private onJudgeCallbacks: Set<JudgeCallback> = new Set()
  private onGameOverCallbacks: Set<GameOverCallback> = new Set()
  private missCheckTimer: number | null = null
  private isActive: boolean = false
  private lastHitTime: number = 0
  private readonly inputDebounceMs: number = 50

  setTolerance(toleranceMs: number): void {
    this.baseToleranceMs = Math.max(40, Math.min(150, toleranceMs))
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(40, Math.min(300, bpm))
  }

  private getScaledTolerance(): number {
    const beatDurationMs = (60 / this.bpm) * 1000
    const sixteenthDurationMs = beatDurationMs / 4

    // Cap at 60% of a sixteenth note to prevent hitting wrong notes
    // but ensure a minimum floor of 50ms so high BPM still feels playable
    const maxToleranceForBpm = Math.max(50, sixteenthDurationMs * 0.6)

    // Gentle BPM scaling - reduce tolerance slightly at higher BPM
    const bpmScale = Math.max(0.7, 1 - (this.bpm - 60) / 400)
    const scaledBase = this.baseToleranceMs * bpmScale

    return Math.min(scaledBase, maxToleranceForBpm)
  }

  private getEarlyWindow(): number {
    const tolerance = this.getScaledTolerance()
    const beatDurationMs = (60 / this.bpm) * 1000
    // Allow hitting up to 40% of a beat early, but scale with tolerance
    const maxEarly = beatDurationMs * 0.4
    return Math.min(tolerance * 2, maxEarly)
  }

  setLatencyOffset(offsetMs: number): void {
    this.latencyOffsetMs = offsetMs
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
    this.lastHitTime = 0
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

    // Debounce to prevent double-fires from touch/pointer events
    // 50ms is short enough to allow fast 16th notes at high BPM
    if ((hitTime - this.lastHitTime) * 1000 < this.inputDebounceMs) {
      return
    }
    this.lastHitTime = hitTime

    const unhitOnsets = rhythmBuffer.getUnhitOnsets()
    const nextOnset = unhitOnsets[0]

    if (!nextOnset) {
      this.notifyJudge("miss", null, 0)
      this.triggerGameOver("extra")
      return
    }

    const toleranceMs = this.getScaledTolerance()
    const earlyWindowMs = this.getEarlyWindow()
    const deltaMs = (hitTime - nextOnset.timeSec) * 1000

    // Within hit window - register as hit
    if (deltaMs >= -earlyWindowMs && deltaMs <= toleranceMs) {
      rhythmBuffer.markHit(nextOnset.id)
      this.notifyJudge("hit", nextOnset, deltaMs)
      return
    }

    // Too early (before early window) - extra note
    if (deltaMs < -earlyWindowMs) {
      this.notifyJudge("miss", null, deltaMs)
      this.triggerGameOver("extra")
      return
    }

    // Too late (after tolerance) - let miss check handle game over
  }

  private startMissCheck(): void {
    const check = () => {
      if (!this.isActive) return

      const rawTime = transportEngine.now()
      const adjustedTime = rawTime - this.latencyOffsetMs / 1000
      const toleranceSec = this.getScaledTolerance() / 1000
      const unhitOnsets = rhythmBuffer.getUnhitOnsets()
      const nextOnset = unhitOnsets[0]

      // Check if the next unhit note has expired (player missed it)
      if (nextOnset && adjustedTime > nextOnset.timeSec + toleranceSec) {
        const deltaMs = (adjustedTime - nextOnset.timeSec) * 1000
        this.notifyJudge("miss", nextOnset, deltaMs)
        this.triggerGameOver("miss")
        return
      }

      this.missCheckTimer = requestAnimationFrame(check)
    }

    this.missCheckTimer = requestAnimationFrame(check)
  }

  private notifyJudge(result: HitResult, onset: RuntimeOnset | null, timingError: number): void {
    for (const callback of this.onJudgeCallbacks) {
      callback(result, onset, timingError)
    }
  }

  private triggerGameOver(reason: "miss" | "extra"): void {
    this.stop()
    for (const callback of this.onGameOverCallbacks) {
      callback(reason)
    }
  }
}

export const judgeEngine = new JudgeEngine()
