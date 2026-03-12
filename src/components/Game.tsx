import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Gauge, Signal, Volume2, Users, Music4 } from "lucide-react"
import { useQuery } from "convex/react"
import { HorizontalSwitch } from "@/components/ui/horizontal-switch"
import { AmpSwitch } from "@/components/ui/amp-switch"
import { SoundboardButton } from "@/components/ui/soundboard-button"
import { PlayButton } from "@/components/ui/play-button"
import { PanelContainer } from "@/components/ui/panel-container"
import { Button } from "@/components/ui/button"
import { PageBackButton } from "@/components/ui/page-back-button"
import { ResponsiveModal } from "@/components/ui/responsive-modal"
import { Slider } from "@/components/ui/slider"
import { TipModal } from "@/components/ui/tip-modal"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { calculateBPMColor, getDifficultyFromValue } from "@/lib/format"
import { decodeChallenge, encodeChallenge, generateSeed, type ChallengeData } from "@/lib/random"
import { hasCalibrated, loadSettings, saveSettings } from "@/lib/settings"
import { transportEngine } from "@/engines/TransportEngine"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

interface GroupListEntry {
  group: {
    _id: Id<"groups">
    name: string
    createdAt: number
    createdBy: Id<"users">
  }
  membership: {
    _id: Id<"groupMembers">
    role: "admin" | "member"
  }
  challengeCount: number
}

export function Game() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const session = authClient.useSession()
  const groups = useQuery(api.groups.listForUser, session.data ? {} : "skip") as GroupListEntry[] | undefined

  const challengeParam = searchParams.get("challenge")
  const challengeData = challengeParam ? decodeChallenge(challengeParam) : null
  const isGroupChallenge = Boolean(challengeData?.groupId && challengeData?.challengeId)
  const showChallengeLanding = !!challengeData && !isGroupChallenge

  const [bpm, setBpm] = useState(() => challengeData?.bpm ?? loadSettings().bpm)
  const [difficultyValue, setDifficultyValue] = useState(() => challengeData?.difficulty ?? loadSettings().difficultyValue)
  const [groupMode, setGroupMode] = useState(() => loadSettings().groupMode)
  const [includeTuplets, setIncludeTuplets] = useState(() => challengeData?.tuplets ?? loadSettings().includeTuplets)
  const [playAlongVolume, setPlayAlongVolume] = useState(() => loadSettings().playAlongVolume)
  const [isGroupsModalOpen, setIsGroupsModalOpen] = useState(false)
  const [isAnimatingSliders, setIsAnimatingSliders] = useState(false)

  const difficulty = getDifficultyFromValue(difficultyValue)
  const [isCalibrated] = useState(hasCalibrated)

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

  const startRhythmGame = (challenge?: ChallengeData) => {
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

  const [challengeMode, setChallengeMode] = useState(true)

  const handleChallengeModeChange = (enabled: boolean) => {
    setChallengeMode(enabled)
    if (enabled && challengeData) {
      setIsAnimatingSliders(true)
      setBpm(challengeData.bpm)
      setDifficultyValue(challengeData.difficulty)
      setIncludeTuplets(challengeData.tuplets)
      setTimeout(() => setIsAnimatingSliders(false), 300)
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
        {showChallengeLanding && challengeData && (
          <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center p-4 landscape:px-8 landscape:py-3 gap-6 landscape:gap-12 max-w-lg landscape:max-w-5xl mx-auto w-full relative">
            <PageBackButton to="/" />
            <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center animate-fade-in-up">
              <h1
                className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground uppercase"
                style={{ letterSpacing: "0.1em" }}
              >
                rhythms
              </h1>
              <HorizontalSwitch
                checked={challengeMode}
                onCheckedChange={handleChallengeModeChange}
                label="Challenge"
                className="mt-3"
              />
            </div>

            <PanelContainer className="w-full landscape:w-[480px] landscape:shrink-0 animate-fade-in-up">
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
                  disabled={challengeMode}
                  animate={isAnimatingSliders}
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
                  disabled={challengeMode}
                  animate={isAnimatingSliders}
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

              <div className="h-px bg-border w-full" />

              <div className="flex items-stretch">
                <div className="flex-1 p-6 flex items-start justify-evenly">
                  <AmpSwitch label="Practice" checked={groupMode} onCheckedChange={setGroupMode} />
                  <AmpSwitch
                    label="Tuplets"
                    checked={includeTuplets}
                    onCheckedChange={setIncludeTuplets}
                    disabled={challengeMode}
                  />
                  <SoundboardButton
                    label="Calibrate"
                    onClick={() => navigate("/calibration")}
                    active={isCalibrated}
                    warning={!isCalibrated}
                  />
                </div>

                <div className="w-px bg-border" />

                <div className="p-6 flex items-start justify-center">
                  <PlayButton onClick={() => (challengeMode ? startRhythmGame(challengeData) : startRhythmGame())} />
                </div>
              </div>
            </PanelContainer>
          </div>
        )}

        {!showChallengeLanding && (
          <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center p-4 landscape:px-8 landscape:py-3 gap-6 landscape:gap-12 max-w-lg landscape:max-w-5xl mx-auto w-full relative">
            <button
              type="button"
              onClick={() => navigate("/melody")}
              className="fixed left-4 top-4 z-50 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <Music4 className="w-3 h-3" />
              Melody
            </button>
            <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center gap-4">
              <h1
                className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground animate-fade-in-up uppercase"
                style={{ letterSpacing: "0.1em" }}
              >
                rhythms
              </h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (session.data) {
                    setIsGroupsModalOpen(true)
                  }
                }}
                className={cn(
                  "text-[10px] uppercase tracking-wider transition-opacity",
                  session.data ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                aria-hidden={!session.data}
                tabIndex={session.data ? 0 : -1}
              >
                <Users className="w-3 h-3 mr-1" />
                My groups
              </Button>
            </div>

            <div className="w-full landscape:w-[480px] landscape:shrink-0 flex flex-col gap-4 animate-fade-in-up">
              <PanelContainer>
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

                <div className="h-px bg-border w-full" />

                <div className="flex items-stretch">
                  <div className="flex-1 p-6 flex items-start justify-evenly">
                    <AmpSwitch label="Practice" checked={groupMode} onCheckedChange={setGroupMode} />
                    <AmpSwitch label="Tuplets" checked={includeTuplets} onCheckedChange={setIncludeTuplets} />
                    <SoundboardButton
                      label="Calibrate"
                      onClick={() => navigate("/calibration")}
                      active={isCalibrated}
                      warning={!isCalibrated}
                    />
                  </div>

                  <div className="w-px bg-border" />

                  <div className="p-6 flex items-start justify-center">
                    <PlayButton onClick={() => startRhythmGame()} />
                  </div>
                </div>
              </PanelContainer>
            </div>
          </div>
        )}

        {session.data ? (
          <ResponsiveModal open={isGroupsModalOpen} onOpenChange={setIsGroupsModalOpen} title="My groups">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Your groups ({groups?.length ?? 0})
                </span>
              </div>

              {groups?.length ? (
                <div className="grid gap-2">
                  {groups.map((entry) => (
                    <button
                      key={entry.group._id}
                      type="button"
                      onClick={() => {
                        setIsGroupsModalOpen(false)
                        navigate(`/groups/${entry.group._id}`)
                      }}
                      className={cn("border border-border p-3 text-left", "hover:border-foreground/40 transition-colors")}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground uppercase">{entry.group.name}</span>
                        <span
                          className={cn(
                            "text-[9px] uppercase tracking-wider px-2 py-0.5 border",
                            entry.membership.role === "admin"
                              ? "border-foreground/40 text-foreground"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {entry.membership.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                        <span>{entry.challengeCount} challenges</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-border/70 p-4 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                  No groups yet.
                </div>
              )}
            </div>
          </ResponsiveModal>
        ) : null}

        {showRingerWarning && (
          <TipModal
            title="Playing on iOS?"
            message="Make sure your ringer switch is on - iOS mutes web audio in silent mode. Also, for fast tempos (160+ BPM), a keyboard works best. Touchscreens can miss rapid taps."
            onDismiss={dismissRingerWarning}
          />
        )}
      </main>
    </div>
  )
}
