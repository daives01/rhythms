import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import type { GameScore, RuntimeBar, HitResult, Difficulty } from "@/types"
import { transportEngine } from "@/engines/TransportEngine"
import { rhythmBuffer } from "@/engines/RhythmEngine"
import { judgeEngine } from "@/engines/JudgeEngine"
import { NotationRenderer } from "@/components/NotationRenderer"
import { PanelContainer } from "@/components/ui/panel-container"
import { useKeyboardInput } from "@/hooks/useKeyboardInput"
import { cn } from "@/lib/utils"
import { decodeChallenge } from "@/lib/random"

const LATENCY_OFFSET_KEY = "rhythm-latency-offset"
const SETTINGS_KEY = "rhythm-settings"
const DEFAULT_LATENCY_OFFSET = 25

function loadLatencyOffset(): number {
  try {
    const stored = localStorage.getItem(LATENCY_OFFSET_KEY)
    return stored ? parseInt(stored, 10) : DEFAULT_LATENCY_OFFSET
  } catch {
    return DEFAULT_LATENCY_OFFSET
  }
}

function loadPlayAlongVolume(): number {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (!stored) return 0
    const parsed = JSON.parse(stored)
    return parsed.playAlongVolume ?? 0
  } catch {
    return 0
  }
}

function loadGroupMode(): boolean {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (!stored) return false
    const parsed = JSON.parse(stored)
    return parsed.groupMode ?? false
  } catch {
    return false
  }
}

const getDifficultyFromValue = (v: number): Difficulty => {
  if (v < 0.33) return "easy"
  if (v < 0.67) return "medium"
  return "hard"
}

export function PlayPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const challengeParam = searchParams.get("challenge")
  const challengeDataRef = useRef(challengeParam ? decodeChallenge(challengeParam) : null)
  const challengeData = challengeDataRef.current

  // If no valid challenge, redirect to home
  useEffect(() => {
    if (!challengeData) {
      navigate("/")
    }
  }, [challengeData, navigate])

  const [phase, setPhase] = useState<"countIn" | "running">("countIn")
  const [bars, setBars] = useState<RuntimeBar[]>([])
  const [score, setScore] = useState<GameScore>({
    barsSurvived: 0,
    beatsSurvived: 0,
    totalHits: 0,
    timeSurvived: 0,
  })

  const [currentBar, setCurrentBar] = useState(0)
  const [currentBeat, setCurrentBeat] = useState(0)
  const [beatFraction, setBeatFraction] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [countInBeat, setCountInBeat] = useState<number | null>(null)
  const [lastResult, setLastResult] = useState<HitResult | null>(null)

  const feedbackTimeout = useRef<number | null>(null)
  const animationFrame = useRef<number | null>(null)
  const hasStarted = useRef(false)
  const scoreRef = useRef<GameScore>(score)

  const latencyOffset = loadLatencyOffset()
  const playAlongVolume = loadPlayAlongVolume()
  const groupMode = loadGroupMode()

  const gameBpm = challengeData?.bpm ?? 120
  const gameDifficulty = challengeData ? getDifficultyFromValue(challengeData.difficulty) : "easy"
  const gameTuplets = challengeData?.tuplets ?? false

  // Keep scoreRef in sync with score state
  useEffect(() => {
    scoreRef.current = score
  }, [score])

  const showFeedback = (result: HitResult) => {
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current)
    setLastResult(result)
    feedbackTimeout.current = window.setTimeout(() => {
      setLastResult(null)
    }, 250)
  }

  const handleHit = () => {
    if (phase !== "running") return
    judgeEngine.onHit()
  }

  useKeyboardInput(handleHit, phase === "running" && !groupMode)

  // Start game on mount
  useEffect(() => {
    if (!challengeData || hasStarted.current) return
    hasStarted.current = true

    const startGame = async () => {
      transportEngine.setBpm(gameBpm)
      rhythmBuffer.setDifficulty(gameDifficulty)
      rhythmBuffer.setIncludeTuplets(gameTuplets)

      const toleranceMap: Record<Difficulty, number> = { easy: 130, medium: 100, hard: 70 }
      judgeEngine.setTolerance(toleranceMap[gameDifficulty])
      judgeEngine.setBpm(gameBpm)
      judgeEngine.setLatencyOffset(latencyOffset)
      transportEngine.setRhythmSoundVolume(playAlongVolume)

      await transportEngine.start()

      const initialBars = rhythmBuffer.initialize(challengeData.seed)
      setBars(initialBars)

      if (playAlongVolume > 0) {
        const allOnsets = initialBars.flatMap((bar) => bar.onsets)
        transportEngine.setRhythmOnsets(allOnsets)
      }
    }

    startGame()

    return () => {
      transportEngine.stop()
      judgeEngine.stop()
    }
  }, [challengeData, gameBpm, gameDifficulty, gameTuplets, latencyOffset, playAlongVolume])

  // Beat and judge subscriptions
  useEffect(() => {
    const unsubBeat = transportEngine.onBeat((beat, _bar, isCountIn) => {
      if (isCountIn) {
        setCountInBeat(beat + 1)
      } else {
        setCountInBeat(null)
        if (phase === "countIn") {
          setPhase("running")
          if (!groupMode) {
            judgeEngine.start()
          }
        }
      }
    })

    const unsubJudge = judgeEngine.onJudge((result) => {
      showFeedback(result)
      if (result === "hit") {
        setScore((s) => ({ ...s, totalHits: s.totalHits + 1 }))
      }
    })

    const unsubGameOver = judgeEngine.onGameOver((reason) => {
      transportEngine.stop()
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)

      navigate(`/game-over?challenge=${challengeParam}`, {
        state: {
          score: scoreRef.current,
          gameOverReason: reason,
        },
      })
    })

    return () => {
      unsubBeat()
      unsubJudge()
      unsubGameOver()
    }
  }, [phase, groupMode, navigate, challengeParam])

  // Position updates
  useEffect(() => {
    const updatePosition = () => {
      const pos = transportEngine.getCurrentPosition()
      if (pos) {
        setCurrentBar(pos.bar)
        setCurrentBeat(pos.beat)
        setBeatFraction(pos.beatFraction)
        setCurrentTime(transportEngine.now())

        setScore((s) => ({
          ...s,
          barsSurvived: pos.bar,
          beatsSurvived: pos.bar * 4 + pos.beat,
          timeSurvived: (pos.bar * 4 + pos.beat + pos.beatFraction) * (60 / gameBpm),
        }))

        if (rhythmBuffer.advanceIfNeeded(pos.bar)) {
          const newBars = [...rhythmBuffer.getBars()]
          setBars(newBars)
          if (playAlongVolume > 0) {
            const allOnsets = newBars.flatMap((bar) => bar.onsets)
            transportEngine.setRhythmOnsets(allOnsets)
          }
        }
      }
      animationFrame.current = requestAnimationFrame(updatePosition)
    }

    animationFrame.current = requestAnimationFrame(updatePosition)

    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
    }
  }, [gameBpm, playAlongVolume])

  // Cleanup
  useEffect(() => {
    return () => {
      transportEngine.stop()
      judgeEngine.stop()
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current)
    }
  }, [])

  // Handle escape to stop (practice mode)
  useEffect(() => {
    if (!groupMode) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        transportEngine.stop()
        judgeEngine.stop()
        navigate("/")
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [groupMode, navigate])

  // Prevent touch behaviors during gameplay
  useEffect(() => {
    const preventTouchDefaults = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }

    const preventGestureStart = (e: Event) => {
      e.preventDefault()
    }

    let lastTouchEnd = 0
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) {
        e.preventDefault()
      }
      lastTouchEnd = now
    }

    document.addEventListener("touchmove", preventTouchDefaults, { passive: false })
    document.addEventListener("touchend", preventDoubleTapZoom, { passive: false })
    document.addEventListener("gesturestart", preventGestureStart)
    document.addEventListener("gesturechange", preventGestureStart)
    document.addEventListener("gestureend", preventGestureStart)

    return () => {
      document.removeEventListener("touchmove", preventTouchDefaults)
      document.removeEventListener("touchend", preventDoubleTapZoom)
      document.removeEventListener("gesturestart", preventGestureStart)
      document.removeEventListener("gesturechange", preventGestureStart)
      document.removeEventListener("gestureend", preventGestureStart)
    }
  }, [])

  if (!challengeData) {
    return null
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
        <div
          className={cn(
            "flex-1 flex flex-col items-center justify-center p-3 landscape:p-2 gap-3 landscape:gap-2 w-full animate-fade-in relative",
            !groupMode && phase === "running" && "cursor-pointer select-none"
          )}
          onPointerDown={!groupMode && phase === "running" ? (e) => {
            e.preventDefault()
            e.stopPropagation()
            handleHit()
          } : undefined}
          style={{
            touchAction: "none",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {/* Count-in overlay */}
          {phase === "countIn" && (
            <div className="absolute inset-0 z-10 flex items-end justify-center pb-24 pointer-events-none">
              <div className="relative flex items-center justify-center">
                {countInBeat && (
                  <>
                    <div
                      key={`ring1-${countInBeat}`}
                      className="absolute w-32 landscape:w-24 h-32 landscape:h-24 rounded-full border-primary animate-count-ring"
                    />
                    <div
                      key={`ring2-${countInBeat}`}
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

          {/* Notation Panel */}
          <PanelContainer
            className={cn(
              "w-full max-w-4xl transition-opacity duration-300 pointer-events-none",
              phase === "countIn" && "opacity-30"
            )}
          >
            <div className="p-4 landscape:p-3">
              <NotationRenderer
                bars={bars}
                currentBar={currentBar}
                currentBeat={currentBeat}
                beatFraction={beatFraction}
                currentTime={currentTime}
              />
            </div>
          </PanelContainer>

          {/* Feedback / Stop */}
          <div className="flex items-center justify-center h-8">
            {groupMode ? (
              <button
                onClick={() => {
                  transportEngine.stop()
                  judgeEngine.stop()
                  navigate("/")
                }}
                className="py-1 px-4 text-sm font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Stop
              </button>
            ) : lastResult === "miss" ? (
              <span className="text-xl font-bold text-miss">Miss</span>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  )
}
