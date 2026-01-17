import { useEffect, useState } from "react"
import { useSearchParams, useNavigate, useLocation } from "react-router-dom"
import { RotateCcw, Copy, Check } from "lucide-react"
import type { GameScore, Difficulty } from "@/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { generateSeed, encodeChallenge, decodeChallenge, type ChallengeData } from "@/lib/random"
import { transportEngine } from "@/engines/TransportEngine"

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

const getDifficultyFromValue = (v: number): Difficulty => {
  if (v < 0.33) return "easy"
  if (v < 0.67) return "medium"
  return "hard"
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

  const difficultyBonus = difficultyMultipliers[difficulty]
  const timeBonus = Math.max(1, timeSurvived / 10)
  const bpmBonus = bpm / 120

  return Math.round(hits * difficultyBonus * timeBonus * bpmBonus)
}

function getShareUrl(challenge: string): string {
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  const baseUrl = isLocalhost
    ? `${window.location.protocol}//${window.location.host}`
    : "https://rhythms.daniel-ives.com"
  return `${baseUrl}?challenge=${challenge}`
}

interface LocationState {
  score: GameScore
  gameOverReason: "miss" | "extra"
}

export function GameOverPage() {
  const [searchParams] = useSearchParams()
  const challengeParam = searchParams.get("challenge")
  const challengeData = challengeParam ? decodeChallenge(challengeParam) : null

  const navigate = useNavigate()
  const location = useLocation()
  const [canRestart, setCanRestart] = useState(false)
  const [copied, setCopied] = useState(false)

  const state = location.state as LocationState | null
  const settings = loadSettings()

  // Use state from navigation or fall back to defaults
  const score = state?.score ?? { barsSurvived: 0, beatsSurvived: 0, totalHits: 0, timeSurvived: 0 }
  const gameOverReason = state?.gameOverReason ?? "miss"

  // Get game settings from challenge data or fall back to user settings
  const bpm = challengeData?.bpm ?? settings.bpm
  const difficulty = challengeData
    ? getDifficultyFromValue(challengeData.difficulty)
    : getDifficultyFromValue(settings.difficultyValue)
  const tuplets = challengeData?.tuplets ?? settings.includeTuplets

  const difficultyLabels: Record<Difficulty, string> = { easy: "Easy", medium: "Normal", hard: "Hard" }

  // Prevent accidental restart - delay before buttons are active
  useEffect(() => {
    const timer = setTimeout(() => setCanRestart(true), 800)
    return () => clearTimeout(timer)
  }, [])

  // Handle Enter to play again (new seed)
  useEffect(() => {
    if (!canRestart) return

    const handleEnterRestart = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        handlePlayAgain()
      }
    }
    window.addEventListener("keydown", handleEnterRestart)
    return () => window.removeEventListener("keydown", handleEnterRestart)
  }, [canRestart])

  // Retry with same challenge
  const handleRetry = () => {
    if (!challengeParam) return
    // Unlock audio in click handler context (required for iOS/Safari)
    transportEngine.unlockAudio()
    navigate(`/play?challenge=${challengeParam}`)
  }

  // Play again - go back to menu
  const handlePlayAgain = () => {
    navigate("/")
  }

  const handleCopyLink = async () => {
    if (!challengeParam) return
    const url = getShareUrl(challengeParam)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
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
              {tuplets && (
                <>
                  <span>·</span>
                  <span>Tuplets</span>
                </>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col items-center gap-2 w-full max-w-[200px] animate-fade-in-up opacity-0" style={{ animationDelay: "0.6s" }}>
            {/* Main action row: Retry + Play Again */}
            <div className="flex items-center gap-2 w-full">
              {/* Retry button (icon) */}
              <div className="relative group">
                <button
                  onClick={handleRetry}
                  disabled={!canRestart || !challengeParam}
                  className={cn(
                    "p-2.5 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-colors",
                    (!canRestart || !challengeParam) && "opacity-50 cursor-not-allowed"
                  )}
                  aria-label="Retry same challenge"
                >
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </button>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-popover border border-border rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  Retry same
                </div>
              </div>

              {/* Play Again button */}
              <Button
                size="default"
                onClick={handlePlayAgain}
                disabled={!canRestart}
                className={cn("flex-1", !canRestart && "opacity-50")}
              >
                Play Again
              </Button>
            </div>

            {/* Copy link button */}
            {challengeParam && (
              <button
                onClick={handleCopyLink}
                className={cn(
                  "flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg",
                  "border border-border/50 bg-card/30 hover:bg-card/50 transition-colors",
                  "text-sm text-muted-foreground hover:text-foreground"
                )}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-green-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy challenge link</span>
                  </>
                )}
              </button>
            )}

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
