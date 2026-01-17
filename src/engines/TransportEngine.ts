type TransportCallback = (beat: number, bar: number, isCountIn: boolean) => void

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

  private rhythmSoundVolume: number = 0
  private rhythmOnsets: { timeSec: number; scheduled: boolean }[] = []
  private scheduledOnsetTimes: Set<number> = new Set()

  /**
   * Unlock audio for iOS/Safari. MUST be called synchronously within a user gesture
   * handler (click/touch), before any await statements.
   */
  unlockAudio(): void {
    // iOS silent mode workaround: Play HTML5 Audio element FIRST.
    // This establishes the audio session in "playback" mode (like music)
    // rather than "ambient" mode (sound effects that respect ringer switch).
    // Must happen before Web Audio API initialization.
    this.unlockWithHtmlAudio()

    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }

    // Call resume synchronously - this is the critical part for iOS
    // The promise will resolve later, but the call must happen in gesture context
    this.audioContext.resume()

    // Play silent buffer via Web Audio API
    const buffer = this.audioContext.createBuffer(1, 1, 22050)
    const source = this.audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(this.audioContext.destination)
    source.start(0)
  }

  private unlockWithHtmlAudio(): void {
    // Generate a short silent WAV programmatically (100ms at 8kHz)
    // Must have actual duration for iOS to properly establish the audio session
    const sampleRate = 8000
    const duration = 0.1
    const numSamples = Math.ceil(duration * sampleRate)
    const headerSize = 44
    const dataSize = numSamples * 2 // 16-bit samples
    const buffer = new ArrayBuffer(headerSize + dataSize)
    const view = new DataView(buffer)

    // RIFF header
    this.writeString(view, 0, "RIFF")
    view.setUint32(4, 36 + dataSize, true)
    this.writeString(view, 8, "WAVE")

    // fmt chunk
    this.writeString(view, 12, "fmt ")
    view.setUint32(16, 16, true) // chunk size
    view.setUint16(20, 1, true) // PCM format
    view.setUint16(22, 1, true) // mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true) // byte rate
    view.setUint16(32, 2, true) // block align
    view.setUint16(34, 16, true) // bits per sample

    // data chunk (samples are already 0 = silence)
    this.writeString(view, 36, "data")
    view.setUint32(40, dataSize, true)

    const blob = new Blob([buffer], { type: "audio/wav" })
    const audio = new Audio(URL.createObjectURL(blob))
    audio.setAttribute("playsinline", "true")
    audio.volume = 0.01 // Nearly silent but not zero

    // Let it play through - don't pause immediately
    // iOS needs time to establish the audio session
    audio.play().then(() => {
      audio.onended = () => {
        URL.revokeObjectURL(audio.src)
        audio.remove()
      }
    }).catch(() => {
      // Ignore errors - best effort unlock
    })
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  async init(): Promise<void> {
    // Ensure audio is unlocked (in case unlockAudio wasn't called first)
    this.unlockAudio()
    
    // Wait for the context to be running
    if (this.audioContext && this.audioContext.state !== "running") {
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

  setRhythmSoundVolume(volume: number): void {
    this.rhythmSoundVolume = Math.max(0, Math.min(1, volume))
  }

  setRhythmOnsets(onsets: { timeSec: number }[]): void {
    this.rhythmOnsets = onsets.map((o) => ({
      timeSec: o.timeSec,
      scheduled: this.scheduledOnsetTimes.has(o.timeSec),
    }))
  }

  clearRhythmOnsets(): void {
    this.rhythmOnsets = []
    this.scheduledOnsetTimes.clear()
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
    this.clearRhythmOnsets()
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

    if (this.rhythmSoundVolume > 0) {
      for (const onset of this.rhythmOnsets) {
        if (!onset.scheduled && onset.timeSec < currentTime + this.lookahead && onset.timeSec > currentTime - 0.1) {
          this.scheduleRhythmSound(onset.timeSec)
          onset.scheduled = true
          this.scheduledOnsetTimes.add(onset.timeSec)
        }
      }
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

  private scheduleRhythmSound(time: number): void {
    if (!this.audioContext || this.rhythmSoundVolume <= 0) return

    // Clean sidestick/clave sound - simple and punchy
    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()
    const filter = this.audioContext.createBiquadFilter()

    // Pure sine at a wooden "tok" frequency
    osc.type = "sine"
    osc.frequency.value = 1800

    // Bandpass filter for a focused, woody tone
    filter.type = "bandpass"
    filter.frequency.value = 1800
    filter.Q.value = 8

    // Very tight envelope - instant attack, fast decay
    const volume = 0.5 * this.rhythmSoundVolume
    gain.gain.setValueAtTime(volume, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.audioContext.destination)

    osc.start(time)
    osc.stop(time + 0.03)
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
