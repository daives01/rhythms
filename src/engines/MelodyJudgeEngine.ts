import type { RuntimeMelodyEvent } from "@/types"

export interface JudgedMelodyEvent extends RuntimeMelodyEvent {
  barIndex: number
}

export interface MelodyJudgeSnapshot {
  totalNotes: number
  attemptedNotes: number
  correctNotes: number
  missedNotes: number
  wrongDetections: number
  averageResponseMs: number
  completedEventIds: string[]
  activeEventId: string | null
  activeBarIndex: number | null
  activeBeatIndex: number | null
  activeConcertMidi: number | null
  isComplete: boolean
  isGameOver: boolean
}

export class MelodyJudgeEngine {
  private events: JudgedMelodyEvent[]
  private graceWindowSec: number
  private currentIndex = 0
  private correctNotes = 0
  private missedNotes = 0
  private wrongDetections = 0
  private totalResponseMs = 0
  private completedEventIds: string[] = []
  private lastWrongMidi: number | null = null
  private lastAcceptedMidi: number | null = null
  private lastAcceptedAtSec = 0
  private isGameOver = false

  constructor(events: JudgedMelodyEvent[], bpm: number, graceBeats: number = 0.5) {
    this.events = events
    this.graceWindowSec = (60 / bpm) * graceBeats
  }

  getSnapshot(): MelodyJudgeSnapshot {
    const activeEvent = this.events[this.currentIndex] ?? null

    return {
      totalNotes: this.events.length,
      attemptedNotes: Math.min(this.events.length, this.correctNotes + this.missedNotes + (activeEvent ? 1 : 0)),
      correctNotes: this.correctNotes,
      missedNotes: this.missedNotes,
      wrongDetections: this.wrongDetections,
      averageResponseMs: this.correctNotes === 0 ? 0 : Math.round(this.totalResponseMs / this.correctNotes),
      completedEventIds: [...this.completedEventIds],
      activeEventId: activeEvent?.id ?? null,
      activeBarIndex: activeEvent?.barIndex ?? null,
      activeBeatIndex: activeEvent?.beatIndex ?? null,
      activeConcertMidi: activeEvent?.midi ?? null,
      isComplete: this.currentIndex >= this.events.length,
      isGameOver: this.isGameOver,
    }
  }

  appendEvents(newEvents: JudgedMelodyEvent[]): void {
    this.events.push(...newEvents)
  }

  update(currentTimeSec: number): MelodyJudgeSnapshot {
    if (this.isGameOver) {
      return this.getSnapshot()
    }

    const activeEvent = this.events[this.currentIndex]
    if (!activeEvent) {
      return this.getSnapshot()
    }

    const { endSec } = this.getWindowBounds(this.currentIndex)
    if (currentTimeSec > endSec) {
      this.missedNotes += 1
      this.isGameOver = true
    }

    return this.getSnapshot()
  }

  processDetection(midi: number, detectedAtSec: number): MelodyJudgeSnapshot {
    const preflight = this.update(detectedAtSec)
    if (preflight.isGameOver) {
      return preflight
    }

    const activeEvent = this.events[this.currentIndex]
    if (!activeEvent) {
      return this.getSnapshot()
    }

    const { startSec, endSec } = this.getWindowBounds(this.currentIndex)
    if (detectedAtSec < startSec || detectedAtSec > endSec) {
      return this.getSnapshot()
    }

    if (midi === activeEvent.midi) {
      if (this.lastAcceptedMidi === midi && detectedAtSec - this.lastAcceptedAtSec < 0.18) {
        return this.getSnapshot()
      }

      this.completedEventIds.push(activeEvent.id)
      this.correctNotes += 1
      this.totalResponseMs += Math.round(Math.abs(detectedAtSec - activeEvent.timeSec) * 1000)
      this.currentIndex += 1
      this.lastWrongMidi = null
      this.lastAcceptedMidi = midi
      this.lastAcceptedAtSec = detectedAtSec

      return this.getSnapshot()
    }

    if (midi !== this.lastWrongMidi) {
      this.wrongDetections += 1
      this.lastWrongMidi = midi
    }

    return this.getSnapshot()
  }

  private getWindowBounds(index: number): { startSec: number; endSec: number } {
    const event = this.events[index]
    const previous = this.events[index - 1] ?? null
    const next = this.events[index + 1] ?? null

    const startSec = Math.max(
      event.timeSec - this.graceWindowSec,
      previous ? (previous.timeSec + event.timeSec) / 2 : Number.NEGATIVE_INFINITY,
    )
    const endSec = Math.min(
      event.timeSec + this.graceWindowSec,
      next ? (event.timeSec + next.timeSec) / 2 : Number.POSITIVE_INFINITY,
    )

    return { startSec, endSec }
  }
}
