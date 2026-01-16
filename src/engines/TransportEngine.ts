export type TransportCallback = (beat: number, bar: number, isCountIn: boolean) => void

export class TransportEngine {
  private audioContext: AudioContext | null = null
  private bpm: number = 100
  private isRunning: boolean = false
  private startTimeSec: number = 0
  private countInBeats: number = 4
  private countInComplete: boolean = false
  private schedulerTimer: number | null = null
  private nextBeatTime: number = 0
  private currentBeatIndex: number = 0
  private lookahead: number = 0.1
  private scheduleInterval: number = 25
  private onBeatCallbacks: Set<TransportCallback> = new Set()

  private clickFreqHigh: number = 1000
  private clickFreqLow: number = 800
  private clickDuration: number = 0.05

  async init(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume()
    }
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(40, Math.min(240, bpm))
  }

  getBpm(): number {
    return this.bpm
  }

  getSecondsPerBeat(): number {
    return 60 / this.bpm
  }

  getSecondsPerBar(): number {
    return this.getSecondsPerBeat() * 4
  }

  now(): number {
    return this.audioContext?.currentTime ?? 0
  }

  getStartTime(): number {
    return this.startTimeSec
  }

  isCountInDone(): boolean {
    return this.countInComplete
  }

  getIsRunning(): boolean {
    return this.isRunning
  }

  onBeat(callback: TransportCallback): () => void {
    this.onBeatCallbacks.add(callback)
    return () => this.onBeatCallbacks.delete(callback)
  }

  async start(): Promise<void> {
    await this.init()
    if (!this.audioContext || this.isRunning) return

    this.isRunning = true
    this.countInComplete = false
    this.currentBeatIndex = 0
    this.nextBeatTime = this.audioContext.currentTime + 0.05
    this.startTimeSec = this.nextBeatTime + this.countInBeats * this.getSecondsPerBeat()

    this.scheduler()
  }

  stop(): void {
    this.isRunning = false
    if (this.schedulerTimer !== null) {
      clearTimeout(this.schedulerTimer)
      this.schedulerTimer = null
    }
  }

  private scheduler(): void {
    if (!this.audioContext || !this.isRunning) return

    const currentTime = this.audioContext.currentTime

    while (this.nextBeatTime < currentTime + this.lookahead) {
      this.scheduleClick(this.nextBeatTime, this.currentBeatIndex)
      this.notifyBeat(this.nextBeatTime, this.currentBeatIndex)
      this.nextBeatTime += this.getSecondsPerBeat()
      this.currentBeatIndex++
    }

    this.schedulerTimer = window.setTimeout(
      () => this.scheduler(),
      this.scheduleInterval
    )
  }

  private scheduleClick(time: number, beatIndex: number): void {
    if (!this.audioContext) return

    const isCountIn = beatIndex < this.countInBeats
    const beatInBar = beatIndex % 4
    const isAccent = beatInBar === 0

    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()

    osc.connect(gain)
    gain.connect(this.audioContext.destination)

    osc.frequency.value = isAccent ? this.clickFreqHigh : this.clickFreqLow
    osc.type = "square"

    const volume = isCountIn ? 0.3 : 0.15
    gain.gain.setValueAtTime(volume, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + this.clickDuration)

    osc.start(time)
    osc.stop(time + this.clickDuration)
  }

  private notifyBeat(time: number, beatIndex: number): void {
    const isCountIn = beatIndex < this.countInBeats

    if (!isCountIn && !this.countInComplete) {
      this.countInComplete = true
    }

    const adjustedBeat = isCountIn ? beatIndex : beatIndex - this.countInBeats
    const bar = Math.floor(adjustedBeat / 4)
    const beat = adjustedBeat % 4

    if (this.audioContext) {
      const delay = Math.max(0, (time - this.audioContext.currentTime) * 1000)
      setTimeout(() => {
        this.onBeatCallbacks.forEach((cb) => cb(beat, bar, isCountIn))
      }, delay)
    }
  }

  getCurrentPosition(): { bar: number; beat: number; beatFraction: number } | null {
    if (!this.audioContext || !this.isRunning || !this.countInComplete) {
      return null
    }

    const elapsed = this.audioContext.currentTime - this.startTimeSec
    if (elapsed < 0) return null

    const totalBeats = elapsed / this.getSecondsPerBeat()
    const bar = Math.floor(totalBeats / 4)
    const beatInBar = totalBeats % 4
    const beat = Math.floor(beatInBar)
    const beatFraction = beatInBar - beat

    return { bar, beat, beatFraction }
  }

  positionToTime(bar: number, beat: number, subdivision: number = 0, subdivisionDenominator: number = 4): number {
    const beatsFromStart = bar * 4 + beat + subdivision / subdivisionDenominator
    return this.startTimeSec + beatsFromStart * this.getSecondsPerBeat()
  }
}

export const transportEngine = new TransportEngine()
