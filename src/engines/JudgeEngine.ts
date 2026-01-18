import type { RuntimeOnset, HitResult } from "@/types"
import { transportEngine } from "./TransportEngine"
import { rhythmBuffer } from "./RhythmEngine"

type JudgeCallback = (result: HitResult, onset: RuntimeOnset | null, timingError: number) => void
type GameOverCallback = (reason: "miss" | "extra") => void

export class JudgeEngine {
  private bpm: number = 120
  private latencyOffsetMs: number = 0
  private onJudgeCallbacks: Set<JudgeCallback> = new Set()
  private onGameOverCallbacks: Set<GameOverCallback> = new Set()
  private missCheckTimer: number | null = null
  private isActive: boolean = false
  private lastHitTime: number = 0
  private readonly inputDebounceMs: number = 40

  setBpm(bpm: number): void {
    this.bpm = Math.max(40, Math.min(300, bpm))
  }

  private getSixteenthDuration(): number {
    return (60 / this.bpm) * 1000 / 4
  }

  private getEarlyWindow(): number {
    const sixteenthMs = this.getSixteenthDuration()
    // 50% of 16th note, min 60ms for human variance
    return Math.max(60, sixteenthMs * 0.5)
  }

  private getLateWindow(): number {
    const sixteenthMs = this.getSixteenthDuration()
    // 50% of 16th note, min 60ms for human variance
    return Math.max(60, sixteenthMs * 0.5)
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

    // Debounce to filter hardware double-fires
    if ((hitTime - this.lastHitTime) * 1000 < this.inputDebounceMs) {
      return
    }
    this.lastHitTime = hitTime

    const unhitOnsets = rhythmBuffer.getUnhitOnsets()
    const nextOnset = unhitOnsets[0]
    const earlyWindowMs = this.getEarlyWindow()

    // No notes left to hit → extra tap
    if (!nextOnset) {
      this.notifyJudge("miss", null, 0)
      this.triggerGameOver("extra")
      return
    }

    const deltaMs = (hitTime - nextOnset.timeSec) * 1000
    const lateWindowMs = this.getLateWindow()

    // Too early → extra tap
    if (deltaMs < -earlyWindowMs) {
      this.notifyJudge("miss", null, deltaMs)
      this.triggerGameOver("extra")
      return
    }

    // Within window → hit
    if (deltaMs <= lateWindowMs) {
      rhythmBuffer.markHit(nextOnset.id)
      this.notifyJudge("hit", nextOnset, deltaMs)
      return
    }

    // Too late → miss check will handle it
  }

  private startMissCheck(): void {
    const check = () => {
      if (!this.isActive) return

      const rawTime = transportEngine.now()
      const adjustedTime = rawTime - this.latencyOffsetMs / 1000
      const lateWindowSec = this.getLateWindow() / 1000
      const unhitOnsets = rhythmBuffer.getUnhitOnsets()
      const nextOnset = unhitOnsets[0]

      // Note expires after the late window passes
      if (nextOnset && adjustedTime > nextOnset.timeSec + lateWindowSec) {
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
