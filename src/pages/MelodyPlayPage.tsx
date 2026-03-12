import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { MelodyJudgeEngine, type JudgedMelodyEvent, type MelodyJudgeSnapshot } from "@/engines/MelodyJudgeEngine"
import { melodyBuffer } from "@/engines/MelodyEngine"
import { transportEngine } from "@/engines/TransportEngine"
import { MelodyNotationRenderer, type MelodyPositionData } from "@/components/MelodyNotationRenderer"
import { PanelContainer } from "@/components/ui/panel-container"
import { usePitchDetection } from "@/hooks/usePitchDetection"
import { formatMidiNoteName, transposeKeySignature } from "@/lib/melody"
import { applyInstrumentToRuntimeBars } from "@/lib/melody-session"
import { decodeMelodyConfig } from "@/lib/random"
import { cn } from "@/lib/utils"
import type { MelodyGameScore, MelodyPracticeConfig, RuntimeMelodyBar, RuntimeMelodyEvent } from "@/types"

interface MelodyLocationState {
  audioUnlocked?: boolean
}

type SessionMode = "listen" | "mic"
type ListenPhase = "idle" | "countIn" | "running"

const EMPTY_JUDGE_STATE: MelodyJudgeSnapshot = {
  totalNotes: 0,
  attemptedNotes: 0,
  correctNotes: 0,
  missedNotes: 0,
  wrongDetections: 0,
  averageResponseMs: 0,
  completedEventIds: [],
  activeEventId: null,
  activeBarIndex: null,
  activeBeatIndex: null,
  activeConcertMidi: null,
  isComplete: false,
  isGameOver: false,
}

function flattenBars(bars: RuntimeMelodyBar[]): JudgedMelodyEvent[] {
  return bars.flatMap((bar) =>
    bar.events.map((event) => ({
      ...event,
      barIndex: bar.barIndex,
    }))
  )
}

function buildDisplayEventMap(bars: RuntimeMelodyBar[]): Map<string, RuntimeMelodyEvent> {
  return new Map(bars.flatMap((bar) => bar.events.map((event) => [event.id, event])))
}

function cloneBars(bars: RuntimeMelodyBar[]): RuntimeMelodyBar[] {
  return bars.map((bar) => ({ ...bar, events: bar.events.map((event) => ({ ...event })) }))
}

function areSnapshotsEqual(left: MelodyJudgeSnapshot, right: MelodyJudgeSnapshot): boolean {
  return (
    left.totalNotes === right.totalNotes &&
    left.attemptedNotes === right.attemptedNotes &&
    left.correctNotes === right.correctNotes &&
    left.missedNotes === right.missedNotes &&
    left.wrongDetections === right.wrongDetections &&
    left.averageResponseMs === right.averageResponseMs &&
    left.activeEventId === right.activeEventId &&
    left.activeBarIndex === right.activeBarIndex &&
    left.activeBeatIndex === right.activeBeatIndex &&
    left.activeConcertMidi === right.activeConcertMidi &&
    left.isComplete === right.isComplete &&
    left.isGameOver === right.isGameOver &&
    left.completedEventIds.length === right.completedEventIds.length
  )
}

function buildMelodyScore(snapshot: MelodyJudgeSnapshot, currentTimeSec: number): MelodyGameScore {
  const position = transportEngine.getCurrentPosition()
  const timeSurvived = Math.max(0, currentTimeSec - transportEngine.getStartTime())

  return {
    totalNotes: snapshot.totalNotes,
    correctNotes: snapshot.correctNotes,
    missedNotes: snapshot.missedNotes,
    wrongDetections: snapshot.wrongDetections,
    averageResponseMs: snapshot.averageResponseMs,
    timeSurvived,
    barsSurvived: position?.bar ?? snapshot.activeBarIndex ?? 0,
    accuracy: snapshot.totalNotes === 0 ? 0 : Math.round((snapshot.correctNotes / snapshot.totalNotes) * 100),
  }
}

export function MelodyPlayPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const melodyParam = searchParams.get("melody")
  const startParam = searchParams.get("start") as "listen" | "practice" | null
  const config = melodyParam ? decodeMelodyConfig(melodyParam) : null
  const state = (location.state as MelodyLocationState | null) ?? null
  const hasAudioUnlock = Boolean(state?.audioUnlocked)
  const { snapshot: pitchSnapshot, start: startPitchDetection, stop: stopPitchDetection } = usePitchDetection()

  const initialSessionMode: SessionMode = startParam === "practice" ? "mic" : "listen"
  const [sessionMode, setSessionMode] = useState<SessionMode>(initialSessionMode)
  const [listenPhase, setListenPhase] = useState<ListenPhase>(
    initialSessionMode === "listen" && hasAudioUnlock ? "countIn" : "idle"
  )
  const [bars, setBars] = useState<RuntimeMelodyBar[]>([])
  const [countInBeat, setCountInBeat] = useState<number | null>(null)
  const [judgeState, setJudgeState] = useState<MelodyJudgeSnapshot>(EMPTY_JUDGE_STATE)
  const [displayEventMap, setDisplayEventMap] = useState<Map<string, RuntimeMelodyEvent>>(new Map())
  const [concertEventMap, setConcertEventMap] = useState<Map<string, RuntimeMelodyEvent>>(new Map())
  const animationFrame = useRef<number | null>(null)
  const judgeRef = useRef<MelodyJudgeEngine | null>(null)
  const judgeStateRef = useRef<MelodyJudgeSnapshot>(EMPTY_JUDGE_STATE)
  const activeNoteNameRef = useRef<string | null>(null)
  const lastProcessedMidiRef = useRef<number | null>(null)
  const sessionStartedRef = useRef(false)
  const gameOverHandledRef = useRef(false)

  const displayKeySignature = config ? transposeKeySignature(config.keySignature, config.instrument) : "C"
  const activeDisplayEvent = judgeState.activeEventId ? displayEventMap.get(judgeState.activeEventId) ?? null : null
  const activeConcertEvent = judgeState.activeEventId ? concertEventMap.get(judgeState.activeEventId) ?? null : null
  const soundingDebugLabel = activeConcertEvent ? `${formatMidiNoteName(activeConcertEvent.midi)} • midi ${activeConcertEvent.midi} • ${Math.round(activeConcertEvent.frequency)} Hz` : null

  useEffect(() => {
    judgeStateRef.current = judgeState
  }, [judgeState])

  useEffect(() => {
    activeNoteNameRef.current = activeDisplayEvent?.noteName ?? null
  }, [activeDisplayEvent?.noteName])

  useEffect(() => {
    if (!config || !melodyParam) {
      navigate("/melody", { replace: true })
      return
    }

    if (config.sessionMode === "exercise" || config.viewMode === "page") {
      navigate(`/melody-sheet?melody=${melodyParam}`, { replace: true })
    }
  }, [config, melodyParam, navigate])

  function stopTransport() {
    transportEngine.stop()
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current)
      animationFrame.current = null
    }
  }

  function stopCurrentSession() {
    stopTransport()
    stopPitchDetection()
    judgeRef.current = null
    lastProcessedMidiRef.current = null
    sessionStartedRef.current = false
  }

  const getPosition = useCallback((): MelodyPositionData | null => {
    const position = transportEngine.getCurrentPosition()
    if (position) {
      return {
        ...position,
        currentTime: transportEngine.now(),
      }
    }

    if (judgeState.activeBarIndex === null || judgeState.activeBeatIndex === null) {
      return null
    }

    return {
      bar: judgeState.activeBarIndex,
      beat: Math.floor(judgeState.activeBeatIndex),
      beatFraction: judgeState.activeBeatIndex % 1,
      currentTime: 0,
    }
  }, [judgeState.activeBarIndex, judgeState.activeBeatIndex])

  function syncBarsFromBuffer(cfg: MelodyPracticeConfig, appendToJudge: boolean) {
    const concertBars = melodyBuffer.getBars()
    const displayBars = applyInstrumentToRuntimeBars(cloneBars(concertBars), cfg.keySignature, cfg.instrument)

    if (appendToJudge && concertBars.length > 0) {
      const newestBar = concertBars[concertBars.length - 1]
      judgeRef.current?.appendEvents(flattenBars([newestBar]))
    }

    setBars(displayBars)
    setDisplayEventMap(buildDisplayEventMap(displayBars))
    setConcertEventMap(buildDisplayEventMap(concertBars))
    // Playback should stay at sounding pitch; only notation is transposed for the instrument.
    transportEngine.setMelodyEvents(concertBars.flatMap((bar) => bar.events))
  }

  async function startListenSession(cfg: MelodyPracticeConfig) {
    stopCurrentSession()
    gameOverHandledRef.current = false
    setSessionMode("listen")
    setListenPhase("countIn")
    setCountInBeat(null)
    setJudgeState(EMPTY_JUDGE_STATE)
    setDisplayEventMap(new Map())
    setConcertEventMap(new Map())

    transportEngine.setBpm(cfg.bpm)
    transportEngine.setMetronomeVolume(1)
    transportEngine.setRhythmSoundVolume(0)
    transportEngine.setMelodySoundVolume(cfg.melodyVolume)

    melodyBuffer.setDifficulty(cfg.difficulty)
    melodyBuffer.setKeySignature(cfg.keySignature)
    melodyBuffer.setInstrument(cfg.instrument)
    melodyBuffer.setWrittenRange(cfg.rangeLow, cfg.rangeHigh)
    melodyBuffer.setAccidentals(cfg.accidentals)

    await transportEngine.start()

    melodyBuffer.initialize(cfg.seed)
    syncBarsFromBuffer(cfg, false)
    sessionStartedRef.current = true
  }

  async function startMicSession(cfg: MelodyPracticeConfig) {
    stopCurrentSession()
    gameOverHandledRef.current = false
    setSessionMode("mic")
    setListenPhase("countIn")
    setCountInBeat(null)
    setJudgeState(EMPTY_JUDGE_STATE)
    setDisplayEventMap(new Map())
    setConcertEventMap(new Map())

    transportEngine.setBpm(cfg.bpm)
    transportEngine.setMetronomeVolume(1)
    transportEngine.setRhythmSoundVolume(0)
    transportEngine.setMelodySoundVolume(cfg.melodyVolume)

    melodyBuffer.setDifficulty(cfg.difficulty)
    melodyBuffer.setKeySignature(cfg.keySignature)
    melodyBuffer.setInstrument(cfg.instrument)
    melodyBuffer.setWrittenRange(cfg.rangeLow, cfg.rangeHigh)
    melodyBuffer.setAccidentals(cfg.accidentals)

    const pitchPromise = startPitchDetection()
    await transportEngine.start()

    melodyBuffer.initialize(cfg.seed)
    const concertBars = melodyBuffer.getBars()
    const judge = new MelodyJudgeEngine(flattenBars(concertBars), cfg.bpm)
    judgeRef.current = judge
    setJudgeState(judge.getSnapshot())
    syncBarsFromBuffer(cfg, false)

    const pitchStarted = await pitchPromise
    if (!pitchStarted) {
      stopCurrentSession()
      setSessionMode("listen")
      setListenPhase("idle")
      return
    }

    sessionStartedRef.current = true
  }

  const stopCurrentSessionEvent = useEffectEvent(() => {
    stopCurrentSession()
  })

  const startListenSessionEvent = useEffectEvent((cfg: MelodyPracticeConfig) => {
    void startListenSession(cfg)
  })

  const startMicSessionEvent = useEffectEvent((cfg: MelodyPracticeConfig) => {
    void startMicSession(cfg)
  })

  useEffect(() => {
    if (!config || !hasAudioUnlock || sessionStartedRef.current) return

    if (initialSessionMode === "mic") {
      startMicSessionEvent(config)
      return
    }

    startListenSessionEvent(config)
  }, [config, hasAudioUnlock, initialSessionMode])

  useEffect(() => {
    const unsubscribeBeat = transportEngine.onBeat((beat, _bar, isCountIn) => {
      if (isCountIn) {
        setCountInBeat(beat + 1)
        return
      }

      setCountInBeat(null)
      setListenPhase("running")
    })

    return () => unsubscribeBeat()
  }, [])

  useEffect(() => {
    if (!config) return

    const updatePosition = () => {
      const position = transportEngine.getCurrentPosition()

      if (position && melodyBuffer.advanceIfNeeded(position.bar)) {
        syncBarsFromBuffer(config, sessionMode === "mic")
      }

      if (sessionMode === "mic" && judgeRef.current) {
        const snapshot = judgeRef.current.update(transportEngine.now())
        if (!areSnapshotsEqual(judgeStateRef.current, snapshot)) {
          judgeStateRef.current = snapshot
          setJudgeState(snapshot)
        }

        if (snapshot.isGameOver && !gameOverHandledRef.current) {
          gameOverHandledRef.current = true
          const score = buildMelodyScore(snapshot, transportEngine.now())
          stopCurrentSessionEvent()
          navigate(melodyParam ? `/melody-game-over?melody=${melodyParam}` : "/melody-game-over", {
            state: {
              score,
              expectedNoteName: activeNoteNameRef.current,
            },
          })
          return
        }
      }

      animationFrame.current = requestAnimationFrame(updatePosition)
    }

    animationFrame.current = requestAnimationFrame(updatePosition)

    return () => {
      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current)
        animationFrame.current = null
      }
    }
  }, [config, melodyParam, navigate, sessionMode])

  useEffect(() => {
    if (sessionMode !== "mic" || pitchSnapshot.stableMidi === null || !judgeRef.current) return
    if (pitchSnapshot.stableMidi === lastProcessedMidiRef.current) return

    lastProcessedMidiRef.current = pitchSnapshot.stableMidi
    const snapshot = judgeRef.current.processDetection(pitchSnapshot.stableMidi, transportEngine.now())
    judgeStateRef.current = snapshot
    setJudgeState(snapshot)
  }, [pitchSnapshot.stableMidi, sessionMode])

  useEffect(() => {
    if (pitchSnapshot.stableMidi !== null) return
    lastProcessedMidiRef.current = null
  }, [pitchSnapshot.stableMidi])

  useEffect(() => {
    return () => {
      stopCurrentSessionEvent()
    }
  }, [])

  async function handleRestart() {
    if (!config) return

    if (sessionMode === "mic") {
      await startMicSession(config)
      return
    }

    await startListenSession(config)
  }

  if (!config) {
    return null
  }

  const showCountIn = listenPhase === "countIn"

  const micStatus = judgeState.isComplete
    ? "complete"
    : pitchSnapshot.status === "denied" || pitchSnapshot.status === "error"
      ? "error"
      : pitchSnapshot.signalActive
        ? "detected"
        : "listening"

  const micStatusText: Record<typeof micStatus, string> = {
    complete: "Done",
    error: pitchSnapshot.status === "denied" ? "Mic blocked" : "Mic error",
    detected: pitchSnapshot.stableNoteName ?? "—",
    listening: "Listening",
  }

  const micStatusColor: Record<typeof micStatus, string> = {
    complete: "text-emerald-400",
    error: "text-red-400",
    detected: "text-emerald-400",
    listening: "text-muted-foreground",
  }

  return (
    <div
      className="min-h-dvh flex flex-col select-none"
      style={{
        touchAction: "manipulation",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
      }}
    >
      <main className="flex-1 flex flex-col relative overflow-auto">
        <div className="flex-1 flex flex-col items-center justify-center p-3 landscape:p-2 gap-3 landscape:gap-2 w-full animate-fade-in relative">
          {showCountIn && (
            <div className="absolute inset-0 z-10 flex items-end justify-center pb-24 pointer-events-none">
              <div className="relative flex items-center justify-center">
                {countInBeat && (
                  <>
                    <div
                      key={`melody-ring1-${countInBeat}`}
                      className="absolute w-32 landscape:w-24 h-32 landscape:h-24 rounded-full border-primary animate-count-ring"
                    />
                    <div
                      key={`melody-ring2-${countInBeat}`}
                      className="absolute w-32 landscape:w-24 h-32 landscape:h-24 rounded-full border-primary/60 animate-count-ring"
                      style={{ animationDelay: "0.1s" }}
                    />
                  </>
                )}
                <div
                  key={countInBeat}
                  className="text-7xl landscape:text-5xl font-display font-bold text-primary animate-count-pulse leading-none"
                >
                  {countInBeat ?? ""}
                </div>
              </div>
            </div>
          )}

          <PanelContainer
            className={cn(
              "w-full max-w-6xl transition-opacity duration-300",
              showCountIn && "opacity-30"
            )}
          >
            <div className="border-b border-border px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              {sessionMode === "mic" ? "mic on" : "mic off"} • {displayKeySignature} • {config.instrument}
            </div>
            {soundingDebugLabel && (
              <div className="border-b border-border px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                Sounding {soundingDebugLabel}
              </div>
            )}
            <div className="p-4 landscape:p-3">
              <div className="rounded-sm border border-zinc-300/80 bg-[#f8f6ef] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <MelodyNotationRenderer
                  bars={bars}
                  keySignature={displayKeySignature}
                  clef={config.clef}
                  layoutMode={config.viewMode}
                  getPosition={getPosition}
                  activeEventId={sessionMode === "mic" ? judgeState.activeEventId : undefined}
                  completedEventIds={sessionMode === "mic" ? judgeState.completedEventIds : undefined}
                  palette={{ baseColor: "#111111", activeColor: "#d97706", pastColor: "#92400e" }}
                />
              </div>
            </div>
          </PanelContainer>

          {sessionMode === "mic" && (
            <PanelContainer className="w-full max-w-6xl" enableLines={false}>
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={cn("text-sm font-bold uppercase tracking-[0.16em] shrink-0", micStatusColor[micStatus])}>
                    {micStatusText[micStatus]}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground shrink-0">
                    {activeDisplayEvent?.noteName ?? "—"}
                    {pitchSnapshot.signalActive && pitchSnapshot.cents !== null && (
                      <> • {pitchSnapshot.cents > 0 ? "+" : ""}{pitchSnapshot.cents}¢</>
                    )}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground shrink-0 ml-auto">
                    {judgeState.correctNotes}/{judgeState.totalNotes}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleRestart()}
                    className="border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Restart
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCurrentSession()
                      navigate(melodyParam ? `/melody?melody=${melodyParam}` : "/melody")
                    }}
                    className="border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Stop
                  </button>
                </div>
              </div>
            </PanelContainer>
          )}

          {sessionMode === "listen" && (
            <PanelContainer className="w-full max-w-6xl" enableLines={false}>
              <div className="flex items-center justify-end px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    stopCurrentSession()
                    navigate(melodyParam ? `/melody?melody=${melodyParam}` : "/melody")
                  }}
                  className="border border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Stop
                </button>
              </div>
            </PanelContainer>
          )}
        </div>
      </main>
    </div>
  )
}
