import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Gauge, Signal, Volume2 } from "lucide-react"
import type { Difficulty } from "@/types"
import { transportEngine } from "@/engines/TransportEngine"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { AmpSwitch } from "@/components/ui/amp-switch"
import { SoundboardButton } from "@/components/ui/soundboard-button"
import { PlayButton } from "@/components/ui/play-button"
import { PanelContainer } from "@/components/ui/panel-container"
import { generateSeed, encodeChallenge, decodeChallenge, type ChallengeData } from "@/lib/random"

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

export function Game() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Check for challenge in URL (shared challenge link)
  const challengeParam = searchParams.get("challenge")
  const challengeData = challengeParam ? decodeChallenge(challengeParam) : null

  const [bpm, setBpm] = useState(() => loadSettings().bpm)
  const [difficultyValue, setDifficultyValue] = useState(() => loadSettings().difficultyValue)
  const difficulty = getDifficultyFromValue(difficultyValue)

  const [isCalibrated] = useState(hasCalibrated)
  const [groupMode, setGroupMode] = useState(() => loadSettings().groupMode)
  const [includeTuplets, setIncludeTuplets] = useState(() => loadSettings().includeTuplets)
  const [playAlongVolume, setPlayAlongVolume] = useState(() => loadSettings().playAlongVolume)

  // iOS ringer warning
  const IOS_RINGER_KEY = "ios-ringer-dismissed"
  const IOS_RINGER_SESSION_KEY = "ios-ringer-session-shown"
  const [showRingerWarning, setShowRingerWarning] = useState(() => {
    if (typeof window === "undefined") return false
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const dismissed = localStorage.getItem(IOS_RINGER_KEY) === "true"
    const alreadyShownSession = sessionStorage.getItem(IOS_RINGER_SESSION_KEY) === "true"
    return isIOS && !dismissed && !alreadyShownSession
  })

  const dismissRingerWarning = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem(IOS_RINGER_KEY, "true")
    }
    sessionStorage.setItem(IOS_RINGER_SESSION_KEY, "true")
    setShowRingerWarning(false)
  }

  useEffect(() => {
    saveSettings({ bpm, difficultyValue, playAlongVolume, groupMode, includeTuplets })
  }, [bpm, difficultyValue, playAlongVolume, groupMode, includeTuplets])

  const startGame = (challenge?: ChallengeData) => {
    // Create challenge from settings if not provided
    const gameChallenge: ChallengeData = challenge ?? {
      seed: generateSeed(),
      bpm,
      difficulty: difficultyValue,
      tuplets: includeTuplets,
    }

    // Unlock audio in click handler context (required for iOS/Safari)
    transportEngine.unlockAudio()

    // Navigate to play page with challenge
    const encoded = encodeChallenge(gameChallenge)
    navigate(`/play?challenge=${encoded}`)
  }

  const difficultyLabels: Record<Difficulty, string> = { easy: "Easy", medium: "Normal", hard: "Hard" }

  // Show challenge landing page if there's a valid challenge in URL
  const showChallengeLanding = !!challengeData

  // Get display values for challenge
  const challengeDifficulty = challengeData ? getDifficultyFromValue(challengeData.difficulty) : difficulty

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
        {/* Challenge Landing Page */}
        {showChallengeLanding && challengeData && (
          <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center p-4 landscape:px-8 landscape:py-3 gap-6 landscape:gap-12 max-w-lg landscape:max-w-5xl mx-auto w-full">
            {/* Left column: Title */}
            <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center">
              <h2
                className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground animate-fade-in-up uppercase"
                style={{ letterSpacing: "0.1em" }}
              >
                challenge
              </h2>
              <p className="text-muted-foreground/60 text-xs mt-1 animate-fade-in-up">
                Someone sent you a rhythm challenge
              </p>
            </div>

            {/* Right column: Challenge panel */}
            <PanelContainer className="w-full landscape:w-[400px] landscape:shrink-0 animate-fade-in-up">
              {/* Challenge specs */}
              <div className="p-6 flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-display font-bold tabular-nums text-foreground">{challengeData.bpm}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50">BPM</div>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                  <div className="text-2xl font-display font-bold text-foreground">{difficultyLabels[challengeDifficulty]}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Level</div>
                </div>
                {challengeData.tuplets && (
                  <>
                    <div className="w-px h-8 bg-border" />
                    <div className="text-center">
                      <div className="text-2xl font-display font-bold text-foreground">On</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50">Tuplets</div>
                    </div>
                  </>
                )}
              </div>

              <div className="h-px bg-border w-full" />

              {/* Settings */}
              <div className="p-6">
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

              <div className="h-px bg-border w-full" />

              {/* Controls row */}
              <div className="flex items-stretch">
                <div className="flex-1 p-6 flex items-start justify-center">
                  <AmpSwitch
                    label="Practice"
                    checked={groupMode}
                    onCheckedChange={setGroupMode}
                  />
                </div>
                <div className="w-px bg-border" />
                <div className="p-6 flex items-start justify-center">
                  <PlayButton onClick={() => startGame(challengeData)} />
                </div>
              </div>
            </PanelContainer>

            {/* Go to menu link */}
            <button
              onClick={() => setSearchParams({})}
              className="absolute bottom-4 text-xs text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors animate-fade-in-up"
            >
              Go to menu instead
            </button>
          </div>
        )}

        {/* Normal Menu */}
        {!showChallengeLanding && (
          <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center p-4 landscape:px-8 landscape:py-3 gap-6 landscape:gap-12 max-w-lg landscape:max-w-5xl mx-auto w-full relative">
            {/* Left column: Title */}
            <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center">
              <h1
                className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground animate-fade-in-up uppercase"
                style={{ letterSpacing: "0.1em" }}
              >
                rhythms
              </h1>
            </div>

            {/* Right column: Mixer panel */}
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
                  <PlayButton onClick={() => startGame()} />
                </div>
              </div>
            </PanelContainer>

          </div>
        )}

        {/* iOS Ringer Warning Modal */}
        {showRingerWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4">
            <div className="bg-muted border border-border p-5 max-w-xs w-full animate-fade-in">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Not hearing anything?
              </h3>
              <p className="text-xs text-muted-foreground mb-5">
                Make sure your ringer switch is on. iOS mutes web audio when your phone is in silent mode.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => dismissRingerWarning(false)} className="w-full">
                  Got it
                </Button>
                <button
                  onClick={() => dismissRingerWarning(true)}
                  className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors py-2"
                >
                  Don't show again
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
