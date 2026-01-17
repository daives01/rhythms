import { useEffect, useState } from "react"
import { useSearchParams, useNavigate, useLocation } from "react-router-dom"
import { RotateCcw, Copy, Check } from "lucide-react"
import type { GameScore, Difficulty } from "@/types"
import { Button } from "@/components/ui/button"
import { PanelContainer } from "@/components/ui/panel-container"
import { cn } from "@/lib/utils"
import { decodeChallenge } from "@/lib/random"
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

  // Play again - go back to menu
  const handlePlayAgain = () => {
    navigate("/")
  }

  // Retry with same challenge
  const handleRetry = () => {
    if (!challengeParam) return
    // Unlock audio in click handler context (required for iOS/Safari)
    transportEngine.unlockAudio()
    navigate(`/play?challenge=${challengeParam}`)
  }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRestart])

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
        <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center p-4 landscape:px-8 landscape:py-3 gap-6 landscape:gap-12 w-full max-w-lg landscape:max-w-5xl mx-auto relative">
          {/* Left: Title */}
          <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center">
            <h2
              className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground animate-fade-in-up opacity-0"
              style={{ animationDelay: "0.1s", letterSpacing: "0.1em" }}
            >
              game over
            </h2>
            <p
              className="text-muted-foreground/60 text-xs mt-1 animate-fade-in-up opacity-0"
              style={{ animationDelay: "0.15s" }}
            >
              {gameOverReason === "miss" ? "Missed a note" : "Extra tap"}
            </p>
          </div>

          {/* Right: Results panel */}
          <PanelContainer
            className="w-full landscape:w-[400px] landscape:shrink-0 animate-score-reveal opacity-0"
            style={{ animationDelay: "0.2s" }}
          >
            {/* Final score */}
            <div className="p-6 text-center">
              <div className="text-5xl font-display font-bold tabular-nums text-foreground">
                {calculateScore(score.totalHits, bpm, difficulty, score.timeSurvived)}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mt-1">
                Final Score
              </div>
            </div>

            <div className="h-px bg-border w-full" />

            {/* Stats row */}
            <div className="p-6 flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-display font-bold tabular-nums text-foreground">{score.totalHits}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Hits</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <div className="text-2xl font-display font-bold tabular-nums text-foreground">{score.timeSurvived.toFixed(1)}s</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Time</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <div className="text-2xl font-display font-bold tabular-nums text-foreground">{score.barsSurvived}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Bars</div>
              </div>
            </div>

            <div className="h-px bg-border w-full" />

            {/* Game settings */}
            <div className="p-4 flex items-center justify-center gap-4 text-xs text-muted-foreground/60">
              <span className="tabular-nums">{bpm} BPM</span>
              <span className="w-px h-3 bg-border" />
              <span>{difficultyLabels[difficulty]}</span>
              {tuplets && (
                <>
                  <span className="w-px h-3 bg-border" />
                  <span>Tuplets</span>
                </>
              )}
            </div>

            <div className="h-px bg-border w-full" />

            {/* Actions */}
            <div className="p-6 flex items-center gap-3">
              {challengeParam && (
                <button
                  onClick={handleRetry}
                  disabled={!canRestart}
                  className={cn(
                    "p-2.5 border border-border hover:bg-white/5 transition-colors",
                    !canRestart && "opacity-50 cursor-not-allowed"
                  )}
                  aria-label="Retry same challenge"
                  title="Retry same"
                >
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              <Button
                size="default"
                onClick={handlePlayAgain}
                disabled={!canRestart}
                className={cn("flex-1", !canRestart && "opacity-50")}
              >
                Play Again
              </Button>
              {challengeParam && (
                <button
                  onClick={handleCopyLink}
                  className="p-2.5 border border-border hover:bg-white/5 transition-colors"
                  aria-label="Copy challenge link"
                  title="Copy link"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              )}
            </div>
          </PanelContainer>

          {/* Support link */}
          <a
            href="https://buymeacoffee.com/danielives"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 text-[10px] text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors animate-fade-in-up opacity-0"
            style={{ animationDelay: "0.4s" }}
          >
            ♡ Support the dev
          </a>
        </div>
      </main>
    </div>
  )
}
