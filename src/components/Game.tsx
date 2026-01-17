import { useState, useEffect, useRef } from "react"
import type { GameState, GameScore, RuntimeBar, HitResult, Difficulty } from "@/types"
import { transportEngine } from "@/engines/TransportEngine"
import { rhythmBuffer } from "@/engines/RhythmEngine"
import { judgeEngine } from "@/engines/JudgeEngine"
import { NotationRenderer } from "./NotationRenderer"
import { CalibrationScreen } from "./CalibrationScreen"
import { Button } from "@/components/ui/button"
import { Knob } from "@/components/ui/knob"
import { AmpSwitch } from "@/components/ui/amp-switch"
import { useKeyboardInput } from "@/hooks/useKeyboardInput"
import { cn } from "@/lib/utils"

const LATENCY_OFFSET_KEY = "rhythm-latency-offset"
const SETTINGS_KEY = "rhythm-settings"

interface StoredSettings {
  bpm: number
  difficultyValue: number
  playAlongVolume: number
  groupMode: boolean
  includeTuplets: boolean
}

const DEFAULT_SETTINGS: StoredSettings = {
  bpm: 120,
  difficultyValue: 0,
  playAlongVolume: 0,
  groupMode: false,
  includeTuplets: false,
}

const calculateScore = (
  hits: number,
  bpm: number,
  difficulty: Difficulty,
  timeSurvived: number
): number => {
  const difficultyMultipliers: Record<Difficulty, number> = {
    easy: 1,
    medium: 1.5,
    hard: 2.5,
  }
  
  // Base: hits count, scaled by difficulty
  const difficultyBonus = difficultyMultipliers[difficulty]
  const timeBonus = Math.max(1, timeSurvived / 10)
  const bpmBonus = bpm / 120 // normalize to 120 BPM
  
  return Math.round(hits * difficultyBonus * timeBonus * bpmBonus)
}

function loadSettings(): StoredSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (!stored) return DEFAULT_SETTINGS
    const parsed = JSON.parse(stored)
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: Partial<StoredSettings>): void {
  try {
    const current = loadSettings()
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }))
  } catch {
    // ignore
  }
}

function loadLatencyOffset(): number {
  try {
    const stored = localStorage.getItem(LATENCY_OFFSET_KEY)
    return stored ? parseInt(stored, 10) : 0
  } catch {
    return 0
  }
}

function hasCalibrated(): boolean {
  try {
    return localStorage.getItem(LATENCY_OFFSET_KEY) !== null
  } catch {
    return false
  }
}

function saveLatencyOffset(offset: number): void {
  try {
    localStorage.setItem(LATENCY_OFFSET_KEY, String(offset))
  } catch {
    // ignore
  }
}

export function Game() {
  const [gameState, setGameState] = useState<GameState>("idle")
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

  const [bpm, setBpm] = useState(() => loadSettings().bpm)
  const [difficultyValue, setDifficultyValue] = useState(() => loadSettings().difficultyValue)

  // Map continuous value to difficulty zones
  const getDifficultyFromValue = (v: number): Difficulty => {
    if (v < 0.33) return "easy"
    if (v < 0.67) return "medium"
    return "hard"
  }
  const difficulty = getDifficultyFromValue(difficultyValue)

  const [lastResult, setLastResult] = useState<HitResult | null>(null)
  const feedbackTimeout = useRef<number | null>(null)

  const [countInBeat, setCountInBeat] = useState<number | null>(null)
  const [gameOverReason, setGameOverReason] = useState<"miss" | "extra" | null>(null)
  const [showCalibration, setShowCalibration] = useState(false)
  const [latencyOffset, setLatencyOffset] = useState(loadLatencyOffset)
  const [isCalibrated, setIsCalibrated] = useState(hasCalibrated)
  const [groupMode, setGroupMode] = useState(() => loadSettings().groupMode)
  const [includeTuplets, setIncludeTuplets] = useState(() => loadSettings().includeTuplets)
  const [playAlongVolume, setPlayAlongVolume] = useState(() => loadSettings().playAlongVolume)
  const animationFrame = useRef<number | null>(null)
  
  // iOS ringer warning
  const IOS_RINGER_KEY = "ios-ringer-dismissed"
  const [showRingerWarning, setShowRingerWarning] = useState(() => {
    if (typeof window === "undefined") return false
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const dismissed = localStorage.getItem(IOS_RINGER_KEY) === "true"
    return isIOS && !dismissed
  })
  
  const dismissRingerWarning = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem(IOS_RINGER_KEY, "true")
    }
    setShowRingerWarning(false)
  }
  
  // Prevent accidental restart after game over
  const [canRestart, setCanRestart] = useState(true)
  
  // Landscape suggestion for mobile
  const LANDSCAPE_KEY = "landscape-dismissed"
  const [showLandscapeTip, setShowLandscapeTip] = useState(() => {
    if (typeof window === "undefined") return false
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const isPortrait = window.innerHeight > window.innerWidth
    const dismissed = localStorage.getItem(LANDSCAPE_KEY) === "true"
    return isMobile && isPortrait && !dismissed
  })
  
  const dismissLandscapeTip = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem(LANDSCAPE_KEY, "true")
    }
    setShowLandscapeTip(false)
  }

  useEffect(() => {
    judgeEngine.setLatencyOffset(latencyOffset)
  }, [latencyOffset])

  useEffect(() => {
    saveSettings({ bpm, difficultyValue, playAlongVolume, groupMode, includeTuplets })
  }, [bpm, difficultyValue, playAlongVolume, groupMode, includeTuplets])

  const showFeedback = (result: HitResult) => {
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current)
    setLastResult(result)
    feedbackTimeout.current = window.setTimeout(() => {
      setLastResult(null)
    }, 250)
  }

  const handleHit = () => {
    if (gameState !== "running") return
    judgeEngine.onHit()
  }

  const stopGame = () => {
    transportEngine.stop()
    judgeEngine.stop()
    setGameState("idle")
    setCountInBeat(null)
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
  }

  useKeyboardInput(handleHit, gameState === "running" && !groupMode)

  useEffect(() => {
    if (!groupMode || gameState !== "running") return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopGame()
      }
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [groupMode, gameState, stopGame])

  const startGame = async () => {
    // CRITICAL: Unlock audio FIRST, synchronously within the click handler.
    // This must happen before any await to satisfy iOS/Safari audio policies.
    transportEngine.unlockAudio()

    transportEngine.setBpm(bpm)
    rhythmBuffer.setDifficulty(difficulty)
    rhythmBuffer.setIncludeTuplets(includeTuplets)
    const toleranceMap: Record<Difficulty, number> = { easy: 130, medium: 100, hard: 70 }
    judgeEngine.setTolerance(toleranceMap[difficulty])
    judgeEngine.setBpm(bpm)
    judgeEngine.setLatencyOffset(latencyOffset)

    // Set play-along volume
    transportEngine.setRhythmSoundVolume(playAlongVolume)

    setScore({ barsSurvived: 0, beatsSurvived: 0, totalHits: 0, timeSurvived: 0 })
    setGameOverReason(null)

    // Reset position state to prevent scroll position issues on repeat
    setCurrentBar(0)
    setCurrentBeat(0)
    setBeatFraction(0)
    setCurrentTime(0)

    setGameState("countIn")
    setCountInBeat(null)

    await transportEngine.start()

    const initialBars = rhythmBuffer.initialize()
    setBars(initialBars)

    // Pass initial onsets to transport engine for sound playback
    if (playAlongVolume > 0) {
      const allOnsets = initialBars.flatMap((bar) => bar.onsets)
      transportEngine.setRhythmOnsets(allOnsets)
    }
  }

  useEffect(() => {
    if (gameState !== "gameOver" || !canRestart) return

    const handleEnterRestart = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        startGame()
      }
    }
    window.addEventListener("keydown", handleEnterRestart)
    return () => window.removeEventListener("keydown", handleEnterRestart)
  }, [gameState, canRestart])

  useEffect(() => {
    const unsubBeat = transportEngine.onBeat((beat, _bar, isCountIn) => {
      if (isCountIn) {
        setCountInBeat(beat + 1)
      } else {
        setCountInBeat(null)
        if (gameState === "countIn") {
          setGameState("running")
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
      setGameOverReason(reason)
      setGameState("gameOver")
      setCanRestart(false)
      // Prevent accidental restart - delay before Play Again is active
      setTimeout(() => setCanRestart(true), 800)
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
    })

    return () => {
      unsubBeat()
      unsubJudge()
      unsubGameOver()
    }
  }, [gameState, showFeedback, groupMode])

  useEffect(() => {
    if (gameState !== "running" && gameState !== "countIn") return

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
          timeSurvived: (pos.bar * 4 + pos.beat + pos.beatFraction) * (60 / bpm),
        }))

        if (rhythmBuffer.advanceIfNeeded(pos.bar)) {
          const newBars = [...rhythmBuffer.getBars()]
          setBars(newBars)
          // Update onsets for rhythm sound playback
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
  }, [gameState, bpm, playAlongVolume])

  useEffect(() => {
    return () => {
      transportEngine.stop()
      judgeEngine.stop()
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current)
    }
  }, [])

  // Prevent all problematic touch behaviors during active gameplay
  useEffect(() => {
    if (gameState !== "running" && gameState !== "countIn") return

    const preventTouchDefaults = (e: TouchEvent) => {
      // Prevent zoom gestures (2+ fingers)
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }

    const preventGestureStart = (e: Event) => {
      e.preventDefault()
    }

    // Prevent double-tap zoom by intercepting touchend timing
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
    // Prevent Safari gesture events
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
  }, [gameState])

  const difficultyLabels: Record<Difficulty, string> = { easy: "Easy", medium: "Normal", hard: "Hard" }

  const handleCalibrationComplete = (offset: number) => {
    setLatencyOffset(offset)
    saveLatencyOffset(offset)
    setIsCalibrated(true)
    setShowCalibration(false)
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
        {showCalibration && (
          <CalibrationScreen
            onComplete={handleCalibrationComplete}
            onCancel={() => setShowCalibration(false)}
            currentOffset={latencyOffset}
          />
        )}

        {gameState === "idle" && !showCalibration && (
          <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center p-4 landscape:px-8 landscape:py-2 gap-5 landscape:gap-10 max-w-md landscape:max-w-4xl mx-auto w-full">
            {/* Left: Title + buttons (landscape) / Top section (portrait) */}
            <div className="flex flex-col items-center landscape:items-center landscape:justify-center landscape:flex-1 gap-4 landscape:gap-3">
              <h2 className="text-3xl font-display font-bold tracking-tight animate-fade-in-up opacity-0" style={{ animationDelay: "0.1s" }}>
                <span className="text-gradient">Rhythms</span>
              </h2>
              
              {/* Buttons - only in landscape */}
              <div className="hidden landscape:flex flex-col items-center gap-2 animate-fade-in-up opacity-0" style={{ animationDelay: "0.3s" }}>
                <Button
                  size="lg"
                  onClick={startGame}
                  className="px-12 font-semibold animate-pulse-glow"
                >
                  Play
                </Button>
                <button
                  onClick={() => setShowCalibration(true)}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-1"
                >
                  {isCalibrated ? "Calibrate" : "Calibrate (recommended)"}
                </button>
              </div>
            </div>

            {/* Settings Panel */}
            <div
              className="w-full landscape:flex-1 landscape:max-w-md rounded-2xl overflow-hidden animate-fade-in-up opacity-0"
              style={{
                animationDelay: "0.2s",
                background: "linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)",
                border: "1px solid rgba(60,60,60,0.5)",
              }}
            >
              <div className="p-4 landscape:p-2">
                {/* Knobs row */}
                <div className="flex justify-center gap-5 landscape:gap-3 mb-3 landscape:mb-1">
                  <Knob
                    label="Tempo"
                    value={bpm}
                    onValueChange={setBpm}
                    min={60}
                    max={180}
                    step={5}
                    valueFormatter={(v) => `${v}`}
                  />
                  <Knob
                    label="Difficulty"
                    value={difficultyValue}
                    onValueChange={setDifficultyValue}
                    min={0}
                    max={1}
                    step={0.01}
                    valueFormatter={() => difficultyLabels[difficulty]}
                  />
                  <Knob
                    label="Play Along"
                    value={playAlongVolume}
                    onValueChange={setPlayAlongVolume}
                    min={0}
                    max={1}
                    step={0.01}
                    valueFormatter={(v) => v === 0 ? "Off" : `${Math.round(v * 100)}%`}
                  />
                </div>

                {/* Switches row */}
                <div className="flex justify-center gap-8 pt-3 landscape:pt-1 border-t border-zinc-800/50">
                  <AmpSwitch
                    label="Practice"
                    checked={groupMode}
                    onCheckedChange={setGroupMode}
                  />
                  <AmpSwitch
                    label="Tuplets"
                    checked={includeTuplets}
                    onCheckedChange={setIncludeTuplets}
                  />
                </div>
              </div>
            </div>

            {/* Portrait-only buttons */}
            <div className="flex flex-col items-center gap-2 landscape:hidden animate-fade-in-up opacity-0" style={{ animationDelay: "0.3s" }}>
              <Button
                size="lg"
                onClick={startGame}
                className="px-12 font-semibold animate-pulse-glow"
              >
                Play
              </Button>
              <button
                onClick={() => setShowCalibration(true)}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {isCalibrated ? "Calibrate" : "Calibrate (recommended)"}
              </button>
            </div>
          </div>
        )}

        {/* iOS Ringer Warning Modal */}
        {showRingerWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in">
              <div className="text-center mb-4">
                <span className="text-4xl">🔔</span>
              </div>
              <h3 className="text-lg font-semibold text-center mb-2">
                Not hearing anything?
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Make sure your ringer switch is on. iOS mutes web audio when your phone is in silent mode.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => dismissRingerWarning(false)} className="w-full">
                  Got it
                </Button>
                <button
                  onClick={() => dismissRingerWarning(true)}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors py-2"
                >
                  Don't show again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Landscape Tip Modal */}
        {showLandscapeTip && !showRingerWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in">
              <div className="text-center mb-4">
                <span className="text-4xl">📱</span>
              </div>
              <h3 className="text-lg font-semibold text-center mb-2">
                Try landscape mode
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Rotate your phone sideways for a better view of the music notation.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => dismissLandscapeTip(false)} className="w-full">
                  Got it
                </Button>
                <button
                  onClick={() => dismissLandscapeTip(true)}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors py-2"
                >
                  Don't show again
                </button>
              </div>
            </div>
          </div>
        )}

        {(gameState === "countIn" || gameState === "running") && (
          <div 
            className={cn(
              "flex-1 flex flex-col items-center justify-center p-3 landscape:p-2 gap-3 landscape:gap-2 w-full animate-fade-in relative",
              !groupMode && gameState === "running" && "cursor-pointer select-none"
            )}
            onPointerDown={!groupMode && gameState === "running" ? (e) => {
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
            {gameState === "countIn" && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
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
                    style={{
                      textShadow: "0 0 60px rgba(245,158,11,0.6), 0 0 100px rgba(245,158,11,0.3)",
                    }}
                  >
                    {countInBeat ?? ""}
                  </div>
                </div>
              </div>
            )}

            {/* Notation Panel */}
            <div
              className={cn(
                "w-full max-w-4xl rounded-2xl p-3 landscape:p-2 border transition-opacity duration-300",
                "bg-gradient-to-b from-card/90 to-card/60",
                "border-border/40",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_20px_-4px_rgba(0,0,0,0.3)]",
                "backdrop-blur-sm pointer-events-none",
                gameState === "countIn" && "opacity-30"
              )}
            >
              <NotationRenderer
                bars={bars}
                currentBar={currentBar}
                currentBeat={currentBeat}
                beatFraction={beatFraction}
                currentTime={currentTime}
              />
            </div>

            {/* Feedback / Stop */}
            <div className="flex items-center justify-center h-8">
              {groupMode ? (
                <button
                  onClick={stopGame}
                  className="py-1 px-4 text-sm font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Stop
                </button>
              ) : lastResult === "miss" ? (
                <span className="text-xl font-bold text-miss">Miss</span>
              ) : null}
            </div>
          </div>
        )}

        {gameState === "gameOver" && (
          <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center p-4 landscape:p-3 gap-4 landscape:gap-8 w-full max-w-md landscape:max-w-3xl mx-auto relative">
            {/* Score section */}
            <div className="flex flex-col items-center landscape:items-end landscape:flex-1 relative z-10">
              {/* Game Over Title */}
              <h2
                className="text-2xl font-display font-bold text-miss tracking-tight animate-fade-in-up opacity-0"
                style={{ animationDelay: "0.15s", textShadow: "0 0 40px rgba(239,68,68,0.4)" }}
              >
                Game Over
              </h2>
              <p className="text-muted-foreground/60 text-xs mb-3 landscape:mb-2 animate-fade-in-up opacity-0" style={{ animationDelay: "0.2s" }}>
                {gameOverReason === "miss" ? "Missed a note" : "Extra tap"}
              </p>

              {/* Score */}
              <div 
                className="text-5xl landscape:text-4xl font-display tabular-nums text-primary animate-score-reveal opacity-0"
                style={{ animationDelay: "0.3s", textShadow: "0 0 60px rgba(245,158,11,0.5)" }}
              >
                {calculateScore(score.totalHits, bpm, difficulty, score.timeSurvived)}
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 mb-3 landscape:mb-2 animate-fade-in opacity-0" style={{ animationDelay: "0.35s" }}>
                Final Score
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 animate-fade-in-up opacity-0" style={{ animationDelay: "0.45s" }}>
                {[
                  { value: score.totalHits, label: "hits" },
                  { value: `${score.timeSurvived.toFixed(1)}s`, label: "time" },
                  { value: score.barsSurvived, label: "bars" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-lg font-bold text-foreground tabular-nums">{stat.value}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Settings */}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40 mt-2 animate-fade-in opacity-0" style={{ animationDelay: "0.5s" }}>
                <span>{bpm} BPM</span>
                <span>·</span>
                <span>{difficultyLabels[difficulty]}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col items-center gap-2 w-full max-w-[200px] animate-fade-in-up opacity-0" style={{ animationDelay: "0.6s" }}>
              <Button 
                size="default" 
                onClick={startGame} 
                disabled={!canRestart}
                className={cn("w-full", !canRestart && "opacity-50")}
              >
                Play Again
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={stopGame} 
                className="w-full text-muted-foreground/70 hover:text-foreground"
              >
                Menu
              </Button>
              <a
                href="https://buymeacoffee.com/danielives"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors mt-1"
              >
                <span>♡</span> Support the dev
              </a>
            </div>
          </div>
        )}
      </main>

      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div
          className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-30"
          style={{
            background: "radial-gradient(ellipse at center, rgba(245,158,11,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-1/4 right-0 w-[600px] h-[400px] opacity-20"
          style={{
            background: "radial-gradient(ellipse at center, rgba(245,158,11,0.1) 0%, transparent 70%)",
          }}
        />
      </div>
    </div>
  )
}
