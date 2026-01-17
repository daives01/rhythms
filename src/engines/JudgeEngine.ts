import type { RuntimeOnset, HitResult } from "@/types"
import { transportEngine } from "./TransportEngine"
import { rhythmBuffer } from "./RhythmEngine"

export type JudgeCallback = (result: HitResult, onset: RuntimeOnset | null, timingError: number) => void
export type GameOverCallback = (reason: "miss" | "extra") => void

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

  getTolerance(): number {
    return this.getScaledTolerance()
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
    this.lastHitTime = 0
    console.log(`[Judge] Started - BPM=${this.bpm}, baseTolerance=${this.baseToleranceMs}ms, scaledTolerance=${this.getScaledTolerance().toFixed(0)}ms, earlyWindow=${this.getEarlyWindow().toFixed(0)}ms, latencyOffset=${this.latencyOffsetMs}ms`)
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
      console.log(`[Judge] Debounced tap (${((hitTime - this.lastHitTime) * 1000).toFixed(1)}ms since last)`)
      return
    }
    this.lastHitTime = hitTime

    const unhitOnsets = rhythmBuffer.getUnhitOnsets()
    const nextOnset = unhitOnsets[0]

    if (!nextOnset) {
      console.log(`[Judge] ✗ EXTRA NOTE - no unhit onsets remaining`)
      this.notifyJudge("miss", null, 0)
      this.triggerGameOver("extra")
      return
    }

    const toleranceMs = this.getScaledTolerance()
    const earlyWindowMs = this.getEarlyWindow()
    const deltaMs = (hitTime - nextOnset.timeSec) * 1000

    console.log(`[Judge] Tap: delta=${deltaMs.toFixed(1)}ms, window=[-${earlyWindowMs.toFixed(0)}, +${toleranceMs.toFixed(0)}]ms, onset=${nextOnset.id} @ ${nextOnset.timeSec.toFixed(3)}s`)

    // Within the hit window - register the hit
    if (deltaMs >= -earlyWindowMs && deltaMs <= toleranceMs) {
      rhythmBuffer.markHit(nextOnset.id)
      this.notifyJudge("hit", nextOnset, deltaMs)
      console.log(`[Judge] ✓ HIT (${deltaMs > 0 ? 'late' : 'early'} by ${Math.abs(deltaMs).toFixed(1)}ms)`)
      return
    }

    // Too early (before early window) - extra note
    if (deltaMs < -earlyWindowMs) {
      console.log(`[Judge] ✗ EXTRA NOTE - tap too early (${Math.abs(deltaMs).toFixed(1)}ms before onset, window is ${earlyWindowMs.toFixed(0)}ms)`)
      this.notifyJudge("miss", null, deltaMs)
      this.triggerGameOver("extra")
      return
    }

    // Too late (after tolerance) - log but let miss check handle game over
    console.log(`[Judge] Tap too late (${deltaMs.toFixed(1)}ms after onset, tolerance is ${toleranceMs.toFixed(0)}ms)`)
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
        console.log(`[Judge] ✗ MISS DETECTED by timer:`)
        console.log(`  onset=${nextOnset.id} was due at ${nextOnset.timeSec.toFixed(3)}s`)
        console.log(`  current time=${adjustedTime.toFixed(3)}s (raw=${rawTime.toFixed(3)}s, offset=${this.latencyOffsetMs}ms)`)
        console.log(`  tolerance=${(toleranceSec * 1000).toFixed(0)}ms, overdue by ${(deltaMs - toleranceSec * 1000).toFixed(1)}ms`)
        console.log(`  unhit onsets remaining: ${unhitOnsets.length}`)
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
