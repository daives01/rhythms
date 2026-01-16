import { useState, useEffect, useRef } from "react"
import type { GameState, GameScore, RuntimeBar, HitResult, Difficulty } from "@/types"
import { transportEngine } from "@/engines/TransportEngine"
import { rhythmBuffer } from "@/engines/RhythmEngine"
import { judgeEngine } from "@/engines/JudgeEngine"
import { NotationRenderer } from "./NotationRenderer"
import { TouchPad } from "./TouchPad"
import { CalibrationScreen } from "./CalibrationScreen"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useKeyboardInput } from "@/hooks/useKeyboardInput"
import { cn } from "@/lib/utils"
import { NoteIcon } from "./icons/NoteIcon"
import { SettingsIcon } from "./icons/SettingsIcon"

const LATENCY_OFFSET_KEY = "rhythm-latency-offset"

function loadLatencyOffset(): number {
  try {
    const stored = localStorage.getItem(LATENCY_OFFSET_KEY)
    return stored ? parseInt(stored, 10) : 0
  } catch {
    return 0
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

  const [bpm, setBpm] = useState(120)
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")

  const [lastResult, setLastResult] = useState<HitResult | null>(null)
  const feedbackTimeout = useRef<number | null>(null)

  const [countInBeat, setCountInBeat] = useState<number | null>(null)
  const [gameOverReason, setGameOverReason] = useState<"miss" | "extra" | null>(null)
  const [showCalibration, setShowCalibration] = useState(false)
  const [latencyOffset, setLatencyOffset] = useState(loadLatencyOffset)
  const [groupMode, setGroupMode] = useState(false)
  const [includeTuplets, setIncludeTuplets] = useState(false)
  const animationFrame = useRef<number | null>(null)

  useEffect(() => {
    judgeEngine.setLatencyOffset(latencyOffset)
  }, [latencyOffset])

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
  }, [groupMode, gameState])

  const startGame = async () => {
    transportEngine.setBpm(bpm)
    rhythmBuffer.setDifficulty(difficulty)
    rhythmBuffer.setIncludeTuplets(includeTuplets)
    const toleranceMap: Record<Difficulty, number> = { easy: 130, medium: 100, hard: 70 }
    judgeEngine.setTolerance(toleranceMap[difficulty])
    judgeEngine.setBpm(bpm)

    setScore({ barsSurvived: 0, beatsSurvived: 0, totalHits: 0, timeSurvived: 0 })
    setGameOverReason(null)
    setGameState("countIn")
    setCountInBeat(null)

    await transportEngine.start()

    const initialBars = rhythmBuffer.initialize()
    setBars(initialBars)
  }

  const stopGame = () => {
    transportEngine.stop()
    judgeEngine.stop()
    setGameState("idle")
    setCountInBeat(null)
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
  }

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

    const unsubJudge = judgeEngine.onJudge((result, _onset, _timing) => {
      showFeedback(result)
      if (result === "hit") {
        setScore((s) => ({ ...s, totalHits: s.totalHits + 1 }))
      }
    })

    const unsubGameOver = judgeEngine.onGameOver((reason) => {
      transportEngine.stop()
      setGameOverReason(reason)
      setGameState("gameOver")
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
    })

    return () => {
      unsubBeat()
      unsubJudge()
      unsubGameOver()
    }
  }, [gameState, showFeedback])

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
          setBars([...rhythmBuffer.getBars()])
        }
      }

      animationFrame.current = requestAnimationFrame(updatePosition)
    }

    animationFrame.current = requestAnimationFrame(updatePosition)

    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
    }
  }, [gameState, bpm])

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

  const difficulties: Difficulty[] = ["easy", "medium", "hard"]
  const difficultyLabels: Record<Difficulty, string> = { easy: "Easy", medium: "Normal", hard: "Hard" }
  const difficultyIndex = difficulties.indexOf(difficulty)

  const handleCalibrationComplete = (offset: number) => {
    setLatencyOffset(offset)
    saveLatencyOffset(offset)
    setShowCalibration(false)
  }

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden select-none"
      style={{
        touchAction: "manipulation",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
      }}
    >
      <header className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-deep flex items-center justify-center">
              <NoteIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-display font-semibold tracking-tight">
              Rhythm
            </h1>
          </div>

          {gameState === "running" ? (
            <div className="flex items-center gap-5">
              {/* Bar counter with progress ring */}
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 flex items-center justify-center">
                  {/* Background ring */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-border"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="text-primary"
                      style={{
                        strokeDasharray: `${2 * Math.PI * 16}`,
                        strokeDashoffset: `${2 * Math.PI * 16 * (1 - (currentBeat + beatFraction) / 4)}`,
                        transition: "stroke-dashoffset 0.05s linear",
                        filter: "drop-shadow(0 0 4px rgba(245,158,11,0.5))",
                      }}
                    />
                  </svg>
                  <span
                    className="text-lg font-bold tabular-nums text-primary relative z-10"
                    key={score.barsSurvived}
                  >
                    {score.barsSurvived + 1}
                  </span>
                </div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium hidden md:block">
                  Bar
                </div>
              </div>

              {/* Divider */}
              <div className="w-px h-8 bg-border/50" />

              {/* Hits counter */}
              <div className="flex items-center gap-2">
                <span
                  className="text-2xl font-bold tabular-nums text-foreground"
                  key={score.totalHits}
                >
                  {score.totalHits}
                </span>
                <div className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
                  Hits
                </div>
              </div>
            </div>
          ) : gameState === "idle" && !showCalibration ? (
            <button
              onClick={() => setShowCalibration(true)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Settings"
            >
              <SettingsIcon className="w-5 h-5 text-muted-foreground" />
            </button>
          ) : null}
        </div>
      </header>

      <main className="flex-1 flex flex-col relative">
        {showCalibration && (
          <CalibrationScreen
            onComplete={handleCalibrationComplete}
            onCancel={() => setShowCalibration(false)}
            currentOffset={latencyOffset}
          />
        )}

        {gameState === "idle" && !showCalibration && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
            {/* Title Section */}
            <div className="text-center mb-12 animate-fade-in-up opacity-0" style={{ animationDelay: "0.1s" }}>
              <h2 className="text-5xl md:text-6xl font-display font-bold mb-4 tracking-tight">
                <span className="text-gradient">Rhythms</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Tap to the beat. First mistake ends the run.
              </p>
            </div>

            {/* Settings Card */}
            <div
              className="w-full rounded-3xl border border-border/40 overflow-hidden mb-8 animate-fade-in-up opacity-0"
              style={{
                animationDelay: "0.2s",
                background: "linear-gradient(to bottom, rgba(28,25,23,0.6), rgba(12,10,9,0.8))",
                boxShadow: "0 4px 40px -10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div className="p-6 md:p-8 space-y-8">
                <Slider
                  label="Tempo"
                  value={bpm}
                  onValueChange={setBpm}
                  min={60}
                  max={180}
                  step={5}
                  valueFormatter={(v) => `${v} BPM`}
                />

                <Slider
                  label="Difficulty"
                  value={difficultyIndex}
                  onValueChange={(v) => setDifficulty(difficulties[v])}
                  min={0}
                  max={2}
                  step={1}
                  valueFormatter={(v) => difficultyLabels[difficulties[v]]}
                />

                <Switch
                  label="Group Mode"
                  checked={groupMode}
                  onCheckedChange={setGroupMode}
                />

                <Switch
                  label="Tuplets"
                  checked={includeTuplets}
                  onCheckedChange={setIncludeTuplets}
                />
              </div>
            </div>

            {/* Start Button */}
            <div
              className="w-full animate-fade-in-up opacity-0"
              style={{ animationDelay: "0.3s" }}
            >
              <Button
                size="xl"
                onClick={startGame}
                className="w-full text-lg font-semibold animate-pulse-glow"
              >
                Start Playing
              </Button>
            </div>

            {/* Hint text */}
            <p
              className="text-xs text-muted-foreground/70 text-center mt-8 animate-fade-in-up opacity-0 tracking-wide"
              style={{ animationDelay: "0.4s" }}
            >
              {groupMode
                ? "Notes highlight as you play — press Escape or tap Stop to end"
                : "Use any key or tap to play — try two hands for fast rhythms"}
            </p>
          </div>
        )}

        {gameState === "countIn" && (
          <div className="flex-1 flex flex-col p-4 gap-4 max-w-4xl mx-auto w-full animate-fade-in">
            <div
              className={cn(
                "rounded-2xl p-4 md:p-5 border transition-all duration-150",
                "bg-gradient-to-b from-card/90 to-card/60",
                "border-border/40",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_20px_-4px_rgba(0,0,0,0.3)]",
                "backdrop-blur-sm"
              )}
            >
              <NotationRenderer
                bars={bars}
                currentBar={0}
                currentBeat={0}
                beatFraction={0}
                currentTime={transportEngine.now()}
              />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center relative">
                <p className="text-muted-foreground mb-8 text-lg tracking-wide animate-fade-in">
                  Get ready...
                </p>
                <div className="relative flex items-center justify-center">
                  {/* Expanding pulse rings */}
                  {countInBeat && (
                    <>
                      <div
                        key={`ring1-${countInBeat}`}
                        className="absolute w-40 h-40 rounded-full border-primary animate-count-ring"
                      />
                      <div
                        key={`ring2-${countInBeat}`}
                        className="absolute w-40 h-40 rounded-full border-primary/60 animate-count-ring"
                        style={{ animationDelay: "0.1s" }}
                      />
                    </>
                  )}
                  {/* The number */}
                  <div
                    key={countInBeat}
                    className="text-[10rem] md:text-[12rem] font-display font-bold text-primary animate-count-pulse leading-none"
                    style={{
                      textShadow:
                        "0 0 80px rgba(245,158,11,0.6), 0 0 120px rgba(245,158,11,0.3)",
                    }}
                  >
                    {countInBeat ?? ""}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {gameState === "running" && (
          <div className="flex-1 flex flex-col p-4 gap-4 max-w-4xl mx-auto w-full animate-fade-in">
            {/* Notation Panel */}
            <div
              className={cn(
                "rounded-2xl p-4 md:p-5 border transition-all duration-150",
                "bg-gradient-to-b from-card/90 to-card/60",
                "border-border/40",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_20px_-4px_rgba(0,0,0,0.3)]",
                "backdrop-blur-sm"
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

            {/* Flexible spacer */}
            <div className="flex-1 min-h-4" />

            {/* Touch Pad or Stop Button */}
            <div className="max-w-xl mx-auto w-full pb-4 md:pb-6">
              {groupMode ? (
                <Button
                  size="xl"
                  variant="outline"
                  onClick={stopGame}
                  className="w-full text-lg font-semibold"
                >
                  Stop
                </Button>
              ) : (
                <TouchPad
                  onTap={handleHit}
                  lastResult={lastResult}
                />
              )}
            </div>
          </div>
        )}

        {gameState === "gameOver" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
            {/* Game Over Title with dramatic styling */}
            <div className="text-center mb-10 animate-fade-in-up opacity-0" style={{ animationDelay: "0.1s" }}>
              <h2
                className="text-5xl md:text-6xl font-display font-bold text-miss mb-3"
                style={{ textShadow: "0 0 40px rgba(239,68,68,0.4)" }}
              >
                Game Over
              </h2>
              <p className="text-muted-foreground text-lg">
                {gameOverReason === "miss" ? "You missed a note" : "Extra tap detected"}
              </p>
            </div>

            {/* Score Card */}
            <div
              className="w-full rounded-3xl border border-border/50 overflow-hidden mb-8 animate-score-reveal opacity-0"
              style={{
                animationDelay: "0.2s",
                background:
                  "linear-gradient(to bottom, rgba(28,25,23,0.8), rgba(12,10,9,0.9))",
                boxShadow:
                  "0 4px 40px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div className="px-6 py-5 border-b border-border/30">
                <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground text-center font-semibold">
                  Final Score
                </h3>
              </div>

              <div className="grid grid-cols-3 divide-x divide-border/30 py-8">
                {[
                  { value: score.barsSurvived, label: "Bars", highlight: true, delay: 0.3 },
                  { value: score.totalHits, label: "Hits", highlight: false, delay: 0.4 },
                  { value: score.timeSurvived.toFixed(1), label: "Seconds", highlight: false, delay: 0.5 },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="text-center px-4 animate-stat-count opacity-0"
                    style={{ animationDelay: `${stat.delay}s` }}
                  >
                    <div
                      className={cn(
                        "text-4xl md:text-5xl font-bold tabular-nums mb-2",
                        stat.highlight ? "text-primary" : "text-foreground"
                      )}
                      style={
                        stat.highlight
                          ? { textShadow: "0 0 20px rgba(245,158,11,0.4)" }
                          : undefined
                      }
                    >
                      {stat.value}
                    </div>
                    <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-6 py-4 bg-black/20 border-t border-border/30">
                <div className="flex justify-center gap-8 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tempo </span>
                    <span className="font-semibold text-foreground">{bpm}</span>
                    <span className="text-muted-foreground/60 text-xs ml-1">BPM</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Difficulty </span>
                    <span className="font-semibold text-foreground">{difficultyLabels[difficulty]}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div
              className="w-full space-y-3 animate-fade-in-up opacity-0"
              style={{ animationDelay: "0.6s" }}
            >
              <Button size="xl" onClick={startGame} className="w-full">
                Play Again
              </Button>
              <Button variant="outline" size="lg" onClick={stopGame} className="w-full">
                Back to Menu
              </Button>
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
