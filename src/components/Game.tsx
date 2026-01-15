// Game - main game component with musical UI

import { useState, useEffect, useCallback, useRef } from "react"
import type { GameState, GameScore, RuntimeBar, HitResult } from "@/types"
import { transportEngine } from "@/engines/TransportEngine"
import { rhythmBuffer } from "@/engines/RhythmEngine"
import { judgeEngine } from "@/engines/JudgeEngine"
import { NotationRenderer } from "./NotationRenderer"
import { TouchPad } from "./TouchPad"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useKeyboardInput } from "@/hooks/useKeyboardInput"
import { cn } from "@/lib/utils"

// Musical note icon
function NoteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  )
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

  const [bpm, setBpm] = useState(100)
  const [difficulty, setDifficulty] = useState(2)

  const [lastResult, setLastResult] = useState<HitResult | null>(null)
  const [lastTimingError, setLastTimingError] = useState(0)
  const feedbackTimeout = useRef<number | null>(null)

  const [countInBeat, setCountInBeat] = useState<number | null>(null)
  const [gameOverReason, setGameOverReason] = useState<"miss" | "extra" | null>(null)
  const animationFrame = useRef<number | null>(null)

  // Pulse state for beat indicator
  const [beatPulse, setBeatPulse] = useState(false)

  const showFeedback = useCallback((result: HitResult, timing: number) => {
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current)
    setLastResult(result)
    setLastTimingError(timing)
    feedbackTimeout.current = window.setTimeout(() => {
      setLastResult(null)
      setLastTimingError(0)
    }, 250)
  }, [])

  const handleHit = useCallback(() => {
    if (gameState !== "running") return
    judgeEngine.onHit()
  }, [gameState])

  useKeyboardInput(handleHit, gameState === "running")

  const startGame = useCallback(async () => {
    transportEngine.setBpm(bpm)
    rhythmBuffer.setDifficulty(difficulty)
    // Tolerance: 120ms for Easy, down to 70ms for Master
    judgeEngine.setTolerance(130 - difficulty * 12)

    setScore({ barsSurvived: 0, beatsSurvived: 0, totalHits: 0, timeSurvived: 0 })
    setGameOverReason(null)
    setGameState("countIn")
    setCountInBeat(null)

    // IMPORTANT: Start transport FIRST so startTimeSec is set
    await transportEngine.start()

    // THEN initialize rhythm buffer (onset times depend on startTimeSec)
    const initialBars = rhythmBuffer.initialize()
    setBars(initialBars)
  }, [bpm, difficulty])

  const stopGame = useCallback(() => {
    transportEngine.stop()
    judgeEngine.stop()
    setGameState("idle")
    setCountInBeat(null)
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current)
  }, [])

  useEffect(() => {
    const unsubBeat = transportEngine.onBeat((beat, _bar, isCountIn) => {
      setBeatPulse(true)
      setTimeout(() => setBeatPulse(false), 100)

      if (isCountIn) {
        setCountInBeat(beat + 1)
      } else {
        setCountInBeat(null)
        if (gameState === "countIn") {
          setGameState("running")
          judgeEngine.start()
        }
      }
    })

    const unsubJudge = judgeEngine.onJudge((result, _onset, timing) => {
      showFeedback(result, timing)
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

  const difficultyLabels = ["", "Easy", "Normal", "Hard"]

  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      {/* Header */}
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

          {gameState === "running" && (
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Bar</div>
                <div className="text-xl font-bold tabular-nums text-primary">{score.barsSurvived + 1}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Hits</div>
                <div className="text-xl font-bold tabular-nums">{score.totalHits}</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col relative">
        {/* Idle / Setup screen */}
        {gameState === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
            {/* Title section */}
            <div className="text-center mb-10 animate-fade-in-up opacity-0" style={{ animationDelay: "0.1s" }}>
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-3">
                <span className="text-gradient">Endless</span> Mode
              </h2>
              <p className="text-muted-foreground text-lg">
                Tap to the rhythm. First mistake ends the run.
              </p>
            </div>

            {/* Settings card */}
            <div
              className="w-full bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 mb-8 animate-fade-in-up opacity-0"
              style={{ animationDelay: "0.2s" }}
            >
              <div className="space-y-8">
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
                  value={difficulty}
                  onValueChange={setDifficulty}
                  min={1}
                  max={3}
                  step={1}
                  valueFormatter={(v) => difficultyLabels[v]}
                />
              </div>
            </div>

            {/* Start button */}
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

            {/* Hint */}
            <p
              className="text-xs text-muted-foreground text-center mt-6 animate-fade-in-up opacity-0"
              style={{ animationDelay: "0.4s" }}
            >
              Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground">Space</kbd> or tap to play
            </p>
          </div>
        )}

        {/* Count-in screen */}
        {gameState === "countIn" && (
          <div className="flex-1 flex flex-col p-4 gap-4 max-w-4xl mx-auto w-full animate-fade-in">
            {/* Notation display */}
            <div
              className={cn(
                "rounded-2xl p-5 border transition-all duration-150",
                "bg-gradient-to-b from-card to-card/50",
                "border-border/50",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              )}
            >
              <NotationRenderer
                bars={bars}
                currentBar={0}
                currentBeat={0}
                beatFraction={0}
              />
            </div>

            {/* Count-in overlay */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground mb-6 text-lg animate-fade-in">Get ready...</p>
                <div
                  key={countInBeat}
                  className="text-9xl font-display font-bold text-primary animate-count-pulse"
                  style={{
                    textShadow: "0 0 60px rgba(245,158,11,0.5)",
                  }}
                >
                  {countInBeat ?? ""}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Running screen */}
        {gameState === "running" && (
          <div className="flex-1 flex flex-col p-4 gap-4 max-w-4xl mx-auto w-full animate-fade-in">
            {/* Notation display */}
            <div
              className={cn(
                "rounded-2xl p-5 border transition-all duration-150",
                "bg-gradient-to-b from-card to-card/50",
                "border-border/50",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              )}
            >
              <NotationRenderer
                bars={bars}
                currentBar={currentBar}
                currentBeat={currentBeat}
                beatFraction={beatFraction}
              />
            </div>

            {/* Spacer */}
            <div className="flex-1 min-h-8" />

            {/* Touch pad */}
            <div className="max-w-xl mx-auto w-full pb-4">
              <TouchPad
                onTap={handleHit}
                lastResult={lastResult}
                timingError={lastTimingError}
              />
            </div>
          </div>
        )}

        {/* Game over screen */}
        {gameState === "gameOver" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
            {/* Game over title */}
            <div className="text-center mb-8 animate-fade-in-up opacity-0" style={{ animationDelay: "0.1s" }}>
              <h2 className="text-4xl font-display font-bold text-miss mb-2">
                Game Over
              </h2>
              <p className="text-muted-foreground">
                {gameOverReason === "miss" ? "You missed a note" : "Extra tap detected"}
              </p>
            </div>

            {/* Score card */}
            <div
              className="w-full bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 mb-8 animate-fade-in-up opacity-0"
              style={{ animationDelay: "0.2s" }}
            >
              <h3 className="text-sm uppercase tracking-wider text-muted-foreground text-center mb-6">
                Final Score
              </h3>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold text-primary tabular-nums">
                    {score.barsSurvived}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                    Bars
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold tabular-nums">
                    {score.totalHits}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                    Hits
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold tabular-nums">
                    {score.timeSurvived.toFixed(1)}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                    Seconds
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-border/50 my-6" />

              {/* Settings recap */}
              <div className="flex justify-center gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Tempo: </span>
                  <span className="font-semibold">{bpm} BPM</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Difficulty: </span>
                  <span className="font-semibold">{difficultyLabels[difficulty]}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div
              className="w-full space-y-3 animate-fade-in-up opacity-0"
              style={{ animationDelay: "0.3s" }}
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

      {/* Ambient background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        {/* Top spotlight */}
        <div
          className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-30"
          style={{
            background: "radial-gradient(ellipse at center, rgba(245,158,11,0.15) 0%, transparent 70%)",
          }}
        />
        {/* Bottom accent */}
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
