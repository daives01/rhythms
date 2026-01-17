import { useState, useEffect, useRef } from "react"
import type { GameState, GameScore, RuntimeBar, HitResult, Difficulty } from "@/types"
import { transportEngine } from "@/engines/TransportEngine"
import { rhythmBuffer } from "@/engines/RhythmEngine"
import { judgeEngine } from "@/engines/JudgeEngine"
import { NotationRenderer } from "./NotationRenderer"
import { TouchPad } from "./TouchPad"
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

    // Set play-along volume
    transportEngine.setRhythmSoundVolume(playAlongVolume)

    setScore({ barsSurvived: 0, beatsSurvived: 0, totalHits: 0, timeSurvived: 0 })
    setGameOverReason(null)
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

  const difficultyLabels: Record<Difficulty, string> = { easy: "Easy", medium: "Normal", hard: "Hard" }

  const handleCalibrationComplete = (offset: number) => {
    setLatencyOffset(offset)
    saveLatencyOffset(offset)
    setIsCalibrated(true)
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
            </div>

            {/* Amp-style Settings Panel */}
            <div
              className="w-full rounded-2xl overflow-hidden mb-8 animate-fade-in-up opacity-0"
              style={{
                animationDelay: "0.2s",
                background: "linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)",
                border: "1px solid rgba(60,60,60,0.5)",
              }}
            >
              {/* Metal faceplate texture */}
              <div
                className="relative"
                style={{
                  background: "repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.02) 1px, rgba(255,255,255,0.02) 2px)",
                }}
              >
                {/* Screws in corners */}
                <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-zinc-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-zinc-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
                <div className="absolute bottom-3 left-3 w-2 h-2 rounded-full bg-zinc-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
                <div className="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-zinc-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />

                <div className="p-6 md:p-8">
                  {/* Knobs row */}
                  <div className="flex justify-center gap-8 md:gap-12 mb-8">
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
                  <div className="flex justify-center gap-10 md:gap-16 pt-4 border-t border-zinc-800/50">
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
                Play
              </Button>
            </div>



            {/* Calibrate button */}
            <button
              onClick={() => setShowCalibration(true)}
              className="mt-4 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors animate-fade-in-up opacity-0"
              style={{ animationDelay: "0.5s" }}
            >
              {isCalibrated ? "Calibrate" : "Calibrate (recommended)"}
            </button>
          </div>
        )}

        {gameState === "countIn" && (
          <div className="flex-1 flex flex-col justify-center p-4 gap-4 max-w-4xl mx-auto w-full animate-fade-in">
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

            <div className="flex flex-col items-center justify-center">
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
          <div className="flex-1 flex flex-col justify-center p-4 gap-4 max-w-4xl mx-auto w-full animate-fade-in">
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

            {/* Touch Pad or Stop Button */}
            <div className="max-w-xl mx-auto w-full pb-4 md:pb-6">
              {groupMode ? (
                <button
                  onClick={stopGame}
                  className="w-full py-3 text-sm font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Stop
                </button>
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
          <div className="flex-1 flex flex-col items-center justify-center p-4 w-full relative overflow-hidden">
            {/* Dramatic spotlight effect */}
            <div 
              className="absolute inset-0 pointer-events-none animate-fade-in opacity-0"
              style={{
                background: "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(239,68,68,0.15) 0%, transparent 60%)",
                animationDelay: "0s",
              }}
            />
            


            {/* Game Over Title */}
            <div className="relative z-10 text-center mb-6 animate-fade-in-up opacity-0" style={{ animationDelay: "0.15s" }}>
              <h2
                className="text-4xl sm:text-5xl font-display font-bold text-miss tracking-tight"
                style={{ 
                  textShadow: "0 0 40px rgba(239,68,68,0.4)",
                }}
              >
                Game Over
              </h2>
              <p className="text-muted-foreground/60 text-sm mt-2">
                {gameOverReason === "miss" ? "Missed a note" : "Extra tap"}
              </p>
            </div>

            {/* Main Score - hero treatment */}
            <div 
              className="relative z-10 mb-6 animate-score-reveal opacity-0 text-center" 
              style={{ animationDelay: "0.3s" }}
            >
              <div className="relative inline-block">
                <div 
                  className="text-7xl sm:text-8xl md:text-9xl font-display tabular-nums text-primary"
                  style={{ 
                    textShadow: "0 0 80px rgba(245,158,11,0.5), 0 0 40px rgba(245,158,11,0.3)",
                  }}
                >
                  {calculateScore(score.totalHits, bpm, difficulty, score.timeSurvived)}
                </div>
                <div 
                  className="absolute -inset-4 rounded-full opacity-20 blur-2xl -z-10"
                  style={{ background: "radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%)" }}
                />
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground/50 mt-2">
                Final Score
              </div>
            </div>

            {/* Stats ribbon - horizontal flow */}
            <div 
              className="relative z-10 flex items-center justify-center gap-6 sm:gap-10 mb-8 animate-fade-in-up opacity-0"
              style={{ animationDelay: "0.45s" }}
            >
              {[
                { value: score.totalHits, label: "hits" },
                { value: `${score.timeSurvived.toFixed(1)}s`, label: "survived" },
                { value: score.barsSurvived, label: "bars" },
              ].map((stat, i, arr) => (
                <>
                  <div key={stat.label} className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
                      {stat.value}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 mt-1">
                      {stat.label}
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="w-px h-6 bg-border/30 hidden sm:block" />
                  )}
                </>
              ))}
            </div>

            {/* Settings tag - subtle */}
            <div 
              className="relative z-10 flex items-center gap-3 text-xs text-muted-foreground/40 mb-8 animate-fade-in opacity-0"
              style={{ animationDelay: "0.55s" }}
            >
              <span>{bpm} BPM</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{difficultyLabels[difficulty]}</span>
            </div>

            {/* Action Buttons - refined */}
            <div
              className="relative z-10 flex flex-col items-center gap-3 w-full max-w-xs animate-fade-in-up opacity-0"
              style={{ animationDelay: "0.65s" }}
            >
              <Button 
                size="xl" 
                onClick={startGame} 
                className="w-full group relative overflow-hidden"
              >
                <span className="relative z-10">Play Again</span>
              </Button>
              <Button 
                variant="ghost" 
                size="lg" 
                onClick={stopGame} 
                className="w-full text-muted-foreground/70 hover:text-foreground"
              >
                Menu
              </Button>
              
              {/* Coffee Link */}
              <a
                href="https://buymeacoffee.com/danielives"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors mt-4 tracking-wide"
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
