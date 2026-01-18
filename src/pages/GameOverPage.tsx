import { useEffect, useState } from "react"
import { useSearchParams, useNavigate, useLocation } from "react-router-dom"
import { Gauge, Signal, Volume2, RotateCcw, Copy, Check } from "lucide-react"
import type { GameScore, Difficulty } from "@/types"
import { PanelContainer } from "@/components/ui/panel-container"
import { Slider } from "@/components/ui/slider"
import { AmpSwitch } from "@/components/ui/amp-switch"
import { SoundboardButton } from "@/components/ui/soundboard-button"
import { PlayButton } from "@/components/ui/play-button"

import { decodeChallenge, generateSeed, encodeChallenge, type ChallengeData } from "@/lib/random"
import { transportEngine } from "@/engines/TransportEngine"

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
  playAlongVolume: 0.5,
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

function saveSettings(settings: Partial<StoredSettings>): void {
  try {
    const current = loadSettings()
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }))
  } catch {
    // ignore
  }
}

function hasCalibrated(): boolean {
  try {
    return localStorage.getItem(LATENCY_OFFSET_KEY) !== null
  } catch {
    return false
  }
}

const getDifficultyFromValue = (v: number): Difficulty => {
  if (v < 0.33) return "easy"
  if (v < 0.67) return "medium"
  return "hard"
}

const calculateBPMColor = (bpm: number): string => {
  const minBpm = 60
  const maxBpm = 180
  const normalized = Math.min(Math.max((bpm - minBpm) / (maxBpm - minBpm), 0), 1)

  if (normalized <= 0.5) {
    const p = normalized / 0.5
    const r = Math.round(52 + p * (251 - 52))
    const g = Math.round(211 + p * (191 - 211))
    const b = Math.round(153 + p * (36 - 153))
    return `rgb(${r}, ${g}, ${b})`
  } else {
    const p = (normalized - 0.5) / 0.5
    const r = Math.round(251 + p * (248 - 251))
    const g = Math.round(191 + p * (113 - 191))
    const b = Math.round(36 + p * (113 - 36))
    return `rgb(${r}, ${g}, ${b})`
  }
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
  const initialSettings = loadSettings()

  const score = state?.score ?? { barsSurvived: 0, beatsSurvived: 0, totalHits: 0, timeSurvived: 0 }
  const gameOverReason = state?.gameOverReason ?? "miss"

  // Editable settings (initialized from challenge or user settings)
  const [bpm, setBpm] = useState(() => challengeData?.bpm ?? initialSettings.bpm)
  const [difficultyValue, setDifficultyValue] = useState(() => challengeData?.difficulty ?? initialSettings.difficultyValue)
  const [playAlongVolume, setPlayAlongVolume] = useState(() => initialSettings.playAlongVolume)
  const [groupMode, setGroupMode] = useState(() => initialSettings.groupMode)
  const [includeTuplets, setIncludeTuplets] = useState(() => challengeData?.tuplets ?? initialSettings.includeTuplets)
  const [isCalibrated] = useState(hasCalibrated)

  const difficulty = getDifficultyFromValue(difficultyValue)
  
  // Calculate score once based on the challenge settings used during the run
  const [finalScore] = useState(() => {
    const runBpm = challengeData?.bpm ?? initialSettings.bpm
    const runDifficulty = getDifficultyFromValue(challengeData?.difficulty ?? initialSettings.difficultyValue)
    return calculateScore(score.totalHits, runBpm, runDifficulty, score.timeSurvived)
  })

  useEffect(() => {
    saveSettings({ bpm, difficultyValue, playAlongVolume, groupMode, includeTuplets })
  }, [bpm, difficultyValue, playAlongVolume, groupMode, includeTuplets])

  useEffect(() => {
    const timer = setTimeout(() => setCanRestart(true), 500)
    return () => clearTimeout(timer)
  }, [])

  const startGame = (challenge?: ChallengeData) => {
    const gameChallenge: ChallengeData = challenge ?? {
      seed: generateSeed(),
      bpm,
      difficulty: difficultyValue,
      tuplets: includeTuplets,
    }
    transportEngine.unlockAudio()
    const encoded = encodeChallenge(gameChallenge)
    navigate(`/play?challenge=${encoded}`, { state: { audioUnlocked: true } })
  }

  const handleRetry = () => {
    if (!challengeParam || !challengeData) return
    transportEngine.unlockAudio()
    navigate(`/play?challenge=${challengeParam}`, { state: { audioUnlocked: true } })
  }

  const handleCopyLink = async () => {
    if (!challengeParam) return
    const url = getShareUrl(challengeParam)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
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
      <main className="flex-1 flex flex-col relative overflow-x-clip overflow-y-auto">
        <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center p-4 landscape:px-8 landscape:py-3 gap-6 landscape:gap-12 max-w-lg landscape:max-w-5xl mx-auto w-full relative">
          {/* Left column: Title + Score */}
          <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center animate-fade-in-up">
            <h1
              className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground uppercase"
              style={{ letterSpacing: "0.1em" }}
            >
              game over
            </h1>
            <p className="text-muted-foreground/50 text-[10px] uppercase tracking-wider mt-2">
              {gameOverReason === "miss" ? "MISSED A NOTE" : "EXTRA TAP"}
            </p>

            {/* Score display */}
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-display font-bold tabular-nums text-foreground">
                {finalScore}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">pts</span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] uppercase tracking-wider text-muted-foreground/40">
              <span>{score.totalHits} hits</span>
              <span>·</span>
              <span>{score.timeSurvived.toFixed(1)}s</span>
              <span>·</span>
              <span>{score.barsSurvived} bars</span>
            </div>

            {/* Challenge actions */}
            {challengeParam && (
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={canRestart ? handleRetry : undefined}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Share
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right column: Mixer panel (same as main menu) */}
          <PanelContainer className="w-full landscape:w-[480px] landscape:shrink-0 animate-fade-in-up">
            {/* Fader controls */}
            <div className="py-6 pl-10 pr-6 flex flex-col gap-3 relative">
              <div className="absolute top-0 bottom-0 left-10 w-px bg-border" />
              <Slider
                value={bpm}
                onValueChange={setBpm}
                min={60}
                max={180}
                step={5}
                icon={Gauge}
                label="BPM"
                color={calculateBPMColor(bpm)}
                units={["60", "120", "180"]}
              />
              <Slider
                value={difficultyValue}
                onValueChange={setDifficultyValue}
                min={0}
                max={1}
                step={0.01}
                icon={Signal}
                label="Level"
                color={difficulty === "easy" ? "rgb(52, 211, 153)" : difficulty === "medium" ? "rgb(251, 191, 36)" : "rgb(248, 113, 113)"}
                units={["EASY", "NORMAL", "HARD"]}
                snapPoints={[0, 0.5, 1]}
              />
              <Slider
                value={playAlongVolume}
                onValueChange={setPlayAlongVolume}
                min={0}
                max={1}
                step={0.01}
                icon={Volume2}
                label="Monitor"
                color={playAlongVolume === 0 ? "rgb(248, 113, 113)" : "rgb(52, 211, 153)"}
                units={["0%", "50%", "100%"]}
              />
            </div>

            {/* Full-width divider */}
            <div className="h-px bg-border w-full" />

            {/* Controls row */}
            <div className="flex items-stretch">
              {/* Left group: switches + calibrate */}
              <div className="flex-1 p-6 flex items-start justify-evenly">
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
                <SoundboardButton
                  label="Calibrate"
                  onClick={() => navigate("/calibration")}
                  active={isCalibrated}
                  warning={!isCalibrated}
                />
              </div>

              {/* Vertical divider */}
              <div className="w-px bg-border" />

              {/* Right group: play */}
              <div className="p-6 flex items-start justify-center">
                <PlayButton onClick={canRestart ? () => startGame() : undefined} />
              </div>
            </div>
          </PanelContainer>
        </div>
      </main>
    </div>
  )
}
