import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import type { Difficulty } from "@/types"
import { transportEngine } from "@/engines/TransportEngine"
import { Button } from "@/components/ui/button"
import { Knob } from "@/components/ui/knob"
import { AmpSwitch } from "@/components/ui/amp-switch"
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
      <main className="flex-1 flex flex-col relative overflow-auto">
        {/* Challenge Landing Page */}
        {showChallengeLanding && challengeData && (
          <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center p-4 landscape:px-8 landscape:py-2 gap-5 landscape:gap-10 max-w-md landscape:max-w-4xl mx-auto w-full">
            {/* Left: Title + buttons (landscape) / Top section (portrait) */}
            <div className="flex flex-col items-center landscape:items-center landscape:justify-center landscape:flex-1 gap-4 landscape:gap-3">
              <div className="text-center animate-fade-in-up opacity-0" style={{ animationDelay: "0.1s" }}>
                <h2 className="text-3xl font-display font-bold tracking-tight mb-1">
                  <span className="text-gradient">Challenge</span>
                </h2>
                <p className="text-muted-foreground text-sm">
                  Someone sent you a rhythm challenge!
                </p>
              </div>

              {/* Challenge info */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground animate-fade-in-up opacity-0" style={{ animationDelay: "0.15s" }}>
                <span className="font-medium">{challengeData.bpm} BPM</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="font-medium">{difficultyLabels[challengeDifficulty]}</span>
                {challengeData.tuplets && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-medium">Tuplets</span>
                  </>
                )}
              </div>

              {/* Buttons - only in landscape */}
              <div className="hidden landscape:flex flex-col items-center gap-2 animate-fade-in-up opacity-0" style={{ animationDelay: "0.3s" }}>
                <Button
                  size="lg"
                  onClick={() => startGame(challengeData)}
                  className="px-12 font-semibold animate-pulse-glow"
                >
                  Start Challenge
                </Button>
                <button
                  onClick={() => setSearchParams({})}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-1"
                >
                  Go to menu instead
                </button>
              </div>
            </div>

            {/* Settings Panel - simplified for challenge */}
            <div
              className="w-full landscape:flex-1 landscape:max-w-md rounded-2xl overflow-hidden animate-fade-in-up opacity-0"
              style={{
                animationDelay: "0.2s",
                background: "linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)",
                border: "1px solid rgba(60,60,60,0.5)",
              }}
            >
              <div className="p-4 landscape:p-3">
                {/* Practice toggle + Play Along side by side */}
                <div className="flex justify-center items-center gap-8">
                  <AmpSwitch
                    label="Practice"
                    checked={groupMode}
                    onCheckedChange={setGroupMode}
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
              </div>
            </div>

            {/* Portrait-only buttons */}
            <div className="flex flex-col items-center gap-2 landscape:hidden animate-fade-in-up opacity-0" style={{ animationDelay: "0.3s" }}>
              <Button
                size="lg"
                onClick={() => startGame(challengeData)}
                className="px-12 font-semibold animate-pulse-glow"
              >
                Start Challenge
              </Button>
              <button
                onClick={() => setSearchParams({})}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                Go to menu instead
              </button>
            </div>
          </div>
        )}

        {/* Normal Menu */}
        {!showChallengeLanding && (
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
                  onClick={() => startGame()}
                  className="px-12 font-semibold animate-pulse-glow"
                >
                  Play
                </Button>
                <button
                  onClick={() => navigate("/calibration")}
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
                onClick={() => startGame()}
                className="px-12 font-semibold animate-pulse-glow"
              >
                Play
              </Button>
              <button
                onClick={() => navigate("/calibration")}
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
