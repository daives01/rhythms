import { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom"
import { useMutation, useQuery } from "convex/react"
import { CalendarClock, Plus, UserPlus, UserCog, ChevronUp, ChevronDown, Trophy, Gauge, Signal, Volume2, Pencil } from "lucide-react"
import { PanelContainer } from "@/components/ui/panel-container"
import { Button } from "@/components/ui/button"
import { PageBackButton } from "@/components/ui/page-back-button"
import { AuthLoading } from "@/components/auth/AuthLoading"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { encodeChallenge, generateSeed, type ChallengeData } from "@/lib/random"
import type { GameScore } from "@/types"
import { ChallengeLeaderboard } from "@/components/challenges/ChallengeLeaderboard"
import { ChallengeCompletions, UserChallengeCompletions } from "@/components/challenges/ChallengeCompletions"
import { transportEngine } from "@/engines/TransportEngine"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { InviteManager } from "@/components/groups/InviteManager"
import { MemberManager } from "@/components/groups/MemberManager"
import { ResponsiveModal } from "@/components/ui/responsive-modal"
import { buildAuthSearch, getReturnToFromLocation } from "@/lib/auth-redirect"
import { Slider } from "@/components/ui/slider"
import { AmpSwitch } from "@/components/ui/amp-switch"
import { SoundboardButton } from "@/components/ui/soundboard-button"
import { PlayButton } from "@/components/ui/play-button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { loadSettings, saveSettings, hasCalibrated } from "@/lib/settings"
import { formatShortDate, formatDifficultyLabel, getDifficultyFromValue, calculateBPMColor, difficultyValueMap } from "@/lib/format"

function formatShortDateTime(timestamp: number): string {
  const dateLabel = formatShortDate(timestamp)
  const timeLabel = new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
  return `${dateLabel} at ${timeLabel}`
}

function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}


function getDueStatus(dueAt: number): { text: string; isPast: boolean } {
  const now = Date.now()
  const diff = dueAt - now
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (diff <= 0) return { text: "Past due", isPast: true }
  if (days === 0 && hours === 0) return { text: "Due in < 1 hour", isPast: false }
  if (days === 0) return { text: `Due in ${hours} hour${hours === 1 ? "" : "s"}`, isPast: false }
  if (days === 1) return { text: "Due tomorrow", isPast: false }
  return { text: `Due in ${days} days`, isPast: false }
}

interface ChallengeEntry {
  _id: Id<"challenges">
  _creationTime: number
  groupId: Id<"groups">
  createdBy: Id<"users">
  title: string
  description?: string
  dueAt: number
  tempo?: number
  difficulty?: string
  seed?: string
  tuplets?: boolean
  createdAt: number
}

interface ChallengeFormProps {
  onSubmit: (data: {
    title: string
    dueAt: number
    tempo?: number
    difficulty?: string
    seed?: string
    tuplets?: boolean
  }) => Promise<void>
  isSubmitting: boolean
  onSuccess: () => void
  history?: PlayHistoryEntry[]
}

interface PlayHistoryEntry {
  _id: Id<"playHistory">
  seed: string
  tempo: number
  difficulty: string
  challengeId?: Id<"challenges">
  tuplets?: boolean
  score: number
  createdAt: number
}

function ChallengeForm({ onSubmit, isSubmitting, onSuccess, history }: ChallengeFormProps) {
  const [title, setTitle] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [tempo, setTempo] = useState(120)
  const [difficulty, setDifficulty] = useState("medium")
  const [tupletsEnabled, setTupletsEnabled] = useState(false)
  const [seedMode, setSeedMode] = useState<"random" | "history">("random")
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null)

  const canSubmit =
    title.trim() &&
    dueAt &&
    (seedMode === "random" || (seedMode === "history" && selectedSeed))

  const handleQuickDue = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    date.setHours(23, 59, 0, 0)
    setDueAt(formatLocalDateTime(date))
  }

  const handleSelectHistory = (entry: PlayHistoryEntry) => {
    setSelectedHistoryId(entry._id)
    setSelectedSeed(entry.seed)
    setSeedMode("history")
    setTempo(entry.tempo)
    setDifficulty(entry.difficulty)
    setTupletsEnabled(entry.tuplets ?? false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    
    await onSubmit({
      title: title.trim(),
      dueAt: new Date(dueAt).getTime(),
      tempo,
      difficulty,
      seed: seedMode === "history" ? selectedSeed ?? undefined : undefined,
      tuplets: tupletsEnabled,
    })
    
    onSuccess()
    setTitle("")
    setDueAt("")
    setTempo(120)
    setDifficulty("medium")
    setTupletsEnabled(false)
    setSeedMode("random")
    setSelectedHistoryId(null)
    setSelectedSeed(null)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Challenge name</span>
        </div>
        <input
          aria-label="Challenge title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full bg-background border border-border px-3 py-2 text-[10px] uppercase tracking-wider text-foreground"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Due date</span>
            <span className="text-[10px] text-muted-foreground/50">Set a deadline for the group.</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 3, 7].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => handleQuickDue(days)}
                className="px-2 py-1 text-[9px] uppercase tracking-wider border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
        <input
          aria-label="Challenge due date"
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="w-full bg-background border border-border px-3 py-2 text-[10px] uppercase tracking-wider text-foreground"
        />
      </div>

      <div className="flex flex-col gap-3 border border-border p-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Pattern source</span>
          <span className="text-[10px] text-muted-foreground/50">
            Choose a stable pattern or keep it randomized each play.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSeedMode("random")
              setSelectedHistoryId(null)
              setSelectedSeed(null)
            }}
            className={cn(
              "flex-1 border px-3 py-2 text-[10px] uppercase tracking-wider transition-colors",
              seedMode === "random"
                ? "border-foreground text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            Random
          </button>
          <button
            type="button"
            onClick={() => {
              setSeedMode("history")
            }}
            className={cn(
              "flex-1 border px-3 py-2 text-[10px] uppercase tracking-wider transition-colors",
              seedMode === "history"
                ? "border-foreground text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            From history
          </button>
        </div>

        {seedMode === "random" ? (
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            New pattern generated for each run.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {history?.length ? (
              <div className="max-h-[200px] overflow-y-auto pr-1">
                <div className="grid gap-2">
                  {history.map((entry) => (
                    <button
                      key={entry._id}
                      type="button"
                      onClick={() => handleSelectHistory(entry)}
                      className={cn(
                        "border px-3 py-2 text-left transition-colors",
                        selectedHistoryId === entry._id
                          ? "border-foreground text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
                        <span>{entry.score} pts</span>
                        <span className="text-muted-foreground/60">{formatShortDate(entry.createdAt)}</span>
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                        {entry.tempo} bpm · {formatDifficultyLabel(entry.difficulty)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                No recent sessions yet.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Challenge settings</span>
        <div className="grid gap-2">
          <label className="flex items-center justify-between border border-border px-3 py-2 text-[10px] uppercase tracking-wider">
            <span className="text-muted-foreground">Tempo</span>
            <input
              aria-label="Challenge tempo"
              type="number"
              min={40}
              max={220}
              value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
              disabled={seedMode === "history"}
              className="w-20 bg-transparent text-right text-foreground disabled:text-muted-foreground/40"
            />
          </label>
          <label className="flex items-center justify-between border border-border px-3 py-2 text-[10px] uppercase tracking-wider">
            <span className="text-muted-foreground">Difficulty</span>
            <select
              aria-label="Challenge difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              disabled={seedMode === "history"}
              className="bg-transparent text-right text-foreground disabled:text-muted-foreground/40"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label className="flex items-center justify-between border border-border px-3 py-2 text-[10px] uppercase tracking-wider">
            <span className="text-muted-foreground">Tuplets</span>
            <input
              type="checkbox"
              checked={tupletsEnabled}
              onChange={(e) => setTupletsEnabled(e.target.checked)}
              disabled={seedMode === "history"}
              className="w-4 h-4"
            />
          </label>
        </div>
      </div>

      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={isSubmitting || !canSubmit}
        className="text-[10px] uppercase tracking-wider"
      >
        {isSubmitting ? "Creating..." : "Create challenge"}
      </Button>
    </form>
  )
}

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const session = authClient.useSession()
  
  const groupId = id as Id<"groups">
  const challengeParam = searchParams.get("challenge")
  const challengeId = (challengeParam as Id<"challenges"> | null) ?? null
  
  const groupDetail = useQuery(
    api.groups.getDetail,
    session.data && groupId ? { groupId, includePast: true } : "skip"
  ) as
    | {
        group: { name: string }
        membership: { role: "admin" | "member" }
        memberCount: number
        challenges: ChallengeEntry[]
      }
    | null
    | undefined

  const challengeDetail = useQuery(
    api.challenges.get,
    session.data && challengeId ? { challengeId } : "skip"
  ) as ChallengeEntry | null | undefined
  const currentUser = useQuery(api.users.getAuthUser, session.data ? {} : "skip")
  
  const createChallenge = useMutation(api.challenges.create)
  const updateChallenge = useMutation(api.challenges.update)
  const deleteChallenge = useMutation(api.challenges.delete_)
  const playHistory = useQuery(api.playHistory.listForUser, session.data ? { limit: 12 } : "skip")
  const groupCompletions = useQuery(
    api.playHistory.listForGroupByUser,
    session.data && groupId ? { groupId, limit: 200 } : "skip"
  )

  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false)
  const [showPastChallenges, setShowPastChallenges] = useState(false)
  
  const [editingChallenge, setEditingChallenge] = useState<ChallengeEntry | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDueAt, setEditDueAt] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const [bpm, setBpm] = useState(() => loadSettings().bpm)
  const [difficultyValue, setDifficultyValue] = useState(() => loadSettings().difficultyValue)
  const [playAlongVolume, setPlayAlongVolume] = useState(() => loadSettings().playAlongVolume)
  const [groupMode, setGroupMode] = useState(() => loadSettings().groupMode)
  const [includeTuplets, setIncludeTuplets] = useState(() => loadSettings().includeTuplets)
  const [isCalibrated] = useState(hasCalibrated)
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false)
  const [leaderboardChallengeId, setLeaderboardChallengeId] = useState<Id<"challenges"> | null>(null)
  const [isCompletionsModalOpen, setIsCompletionsModalOpen] = useState(false)
  const [completionsChallengeId, setCompletionsChallengeId] = useState<Id<"challenges"> | null>(null)
  const [timeTick, setTimeTick] = useState(0)

  const difficulty = getDifficultyFromValue(difficultyValue)

  useEffect(() => {
    saveSettings({ bpm, difficultyValue, playAlongVolume, groupMode, includeTuplets })
  }, [bpm, difficultyValue, playAlongVolume, groupMode, includeTuplets])

  useEffect(() => {
    if (!groupDetail?.challenges?.length) return
    const nextDueAt = groupDetail.challenges
      .map((challenge) => challenge.dueAt)
      .filter((dueAt) => dueAt > Date.now())
      .sort((a, b) => a - b)[0]
    if (!nextDueAt) return

    const delay = Math.max(nextDueAt - Date.now(), 0)
    const timer = window.setTimeout(() => {
      setTimeTick((value) => value + 1)
    }, delay)

    return () => window.clearTimeout(timer)
  }, [groupDetail?.challenges, timeTick])

  const isAdmin = groupDetail?.membership.role === "admin"

  const now = Date.now()
  const activeChallenges = groupDetail?.challenges.filter((c) => c.dueAt >= now) ?? []
  const pastChallenges = groupDetail?.challenges.filter((c) => c.dueAt < now) ?? []

  const navigateToChallenge = (challenge: ChallengeEntry, options?: { unlockAudio?: boolean }) => {
    const challengeDifficulty = challenge.difficulty
      ? difficultyValueMap[challenge.difficulty] ?? 0.5
      : difficultyValue
    const challengeTuplets = challenge.tuplets ?? includeTuplets
    const challengeData: ChallengeData = {
      seed: challenge.seed ?? generateSeed(),
      bpm: challenge.tempo ?? bpm,
      difficulty: challengeDifficulty,
      tuplets: challengeTuplets,
      groupId: challenge.groupId,
      challengeId: challenge._id,
    }
    if (options?.unlockAudio) {
      transportEngine.unlockAudio()
    }
    const encoded = encodeChallenge(challengeData)
    navigate(`/play?challenge=${encoded}`, { state: { audioUnlocked: true } })
  }

  const handleStartChallenge = (challenge: ChallengeEntry) => {
    navigate(`/groups/${groupId}?challenge=${challenge._id}`)
  }

  const handleOpenLeaderboard = (challengeId: Id<"challenges">) => {
    setLeaderboardChallengeId(challengeId)
    setIsLeaderboardModalOpen(true)
  }

  const handleOpenCompletions = (challengeId: Id<"challenges">) => {
    setCompletionsChallengeId(challengeId)
    setIsCompletionsModalOpen(true)
  }

  const handleCreateChallenge = async (data: {
    title: string
    dueAt: number
    tempo?: number
    difficulty?: string
    seed?: string
    tuplets?: boolean
  }) => {
    setErrorMessage(null)
    setIsCreatingChallenge(true)
    try {
      await createChallenge({
        groupId,
        title: data.title,
        dueAt: data.dueAt,
        tempo: data.tempo,
        difficulty: data.difficulty,
        seed: data.seed,
        tuplets: data.tuplets,
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create challenge.")
      throw error
    } finally {
      setIsCreatingChallenge(false)
    }
  }

  const startEditing = (challenge: ChallengeEntry) => {
    setEditingChallenge(challenge)
    setEditTitle(challenge.title)
    setEditDueAt(formatLocalDateTime(new Date(challenge.dueAt)))
  }

  const cancelEditing = () => {
    setEditingChallenge(null)
  }

  const handleSaveEdit = async () => {
    if (!editingChallenge || !editTitle.trim()) return
    setErrorMessage(null)
    setIsSaving(true)
    try {
      await updateChallenge({
        challengeId: editingChallenge._id,
        title: editTitle.trim(),
        dueAt: new Date(editDueAt).getTime(),
      })
      setEditingChallenge(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update challenge.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (challenge: ChallengeEntry) => {
    if (!confirm("Delete this challenge? This action cannot be undone.")) return
    setErrorMessage(null)
    try {
      await deleteChallenge({ challengeId: challenge._id })
      if (editingChallenge?._id === challenge._id) {
        setEditingChallenge(null)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete challenge.")
    }
  }

  const selectedChallenge =
    challengeId && challengeDetail?.groupId === groupId
      ? challengeDetail
      : null
  const showChallengeHub = Boolean(selectedChallenge)

  const handleStartFromHub = () => {
    if (!selectedChallenge) return
    navigateToChallenge(selectedChallenge, { unlockAudio: true })
  }

  const locationState = location.state as { score?: GameScore; finalScore?: number } | null
  const lastScore = locationState?.finalScore
    ?? (locationState?.score
      ? Math.round(locationState.score.totalHits)
      : null)

  useEffect(() => {
    if (!selectedChallenge) return
    setGroupMode(false)
    if (selectedChallenge.tempo !== null && selectedChallenge.tempo !== undefined) {
      setBpm(selectedChallenge.tempo)
    }
    if (selectedChallenge.difficulty) {
      setDifficultyValue(difficultyValueMap[selectedChallenge.difficulty] ?? 0.5)
    }
    if (selectedChallenge.tuplets !== null && selectedChallenge.tuplets !== undefined) {
      setIncludeTuplets(selectedChallenge.tuplets)
    }
  }, [selectedChallenge])

  if (session.isPending) {
    return <AuthLoading label="Loading..." />
  }

  if (!session.data) {
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
            <PageBackButton to="/" />
            {/* Left column - Title */}
            <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center">
              <h1
                className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground uppercase"
                style={{ letterSpacing: "0.1em" }}
              >
                Group
              </h1>
              <p className="text-xs text-muted-foreground mt-2 landscape:text-left text-center">
                Sign in to view this group.
              </p>
            </div>

            {/* Right column - Content */}
            <div className="w-full landscape:w-[480px] landscape:shrink-0">
              <PanelContainer className="w-full">
                <div className="p-6 flex flex-col gap-4">
                  <Button
                    onClick={() => {
                      const returnTo = getReturnToFromLocation(location)
                      navigate({
                        pathname: location.pathname,
                        search: buildAuthSearch(location.search, returnTo),
                      })
                    }}
                    className="w-full"
                  >
                    Sign in
                  </Button>
                </div>
              </PanelContainer>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (groupDetail === undefined) {
    return <AuthLoading />
  }

  if (!groupDetail) {
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
            {/* Left column - Title */}
            <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center">
              <h1
                className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground uppercase"
                style={{ letterSpacing: "0.1em" }}
              >
                Group
              </h1>
              <p className="text-xs text-muted-foreground mt-2 landscape:text-left text-center">
                Group not found or you don&apos;t have access.
              </p>
            </div>

            {/* Right column - Content */}
            <div className="w-full landscape:w-[480px] landscape:shrink-0 flex flex-col gap-4">
              <PanelContainer enableLines>
                <div className="p-6">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                    The group you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
                  </p>
                </div>
              </PanelContainer>
            </div>
          </div>
        </main>
      </div>
    )
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
        {!showChallengeHub && (
          <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center p-4 landscape:px-8 landscape:py-3 gap-6 landscape:gap-12 max-w-lg landscape:max-w-5xl mx-auto w-full relative">
            <PageBackButton to="/" />
            {/* Left column - Title */}
            <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center gap-2">
              <div className="flex items-center gap-3">
                <h1
                  className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground uppercase"
                  style={{ letterSpacing: "0.1em" }}
                >
                  {groupDetail.group.name}
                </h1>
                <span className="text-[9px] uppercase tracking-wider px-2 py-1 border border-border text-muted-foreground">
                  {groupDetail.memberCount} members
                </span>
              </div>
              <p className="text-xs text-muted-foreground landscape:text-left text-center">
                {groupDetail.challenges.length} challenges
              </p>
              {isAdmin && (
                <div className="flex flex-wrap items-center justify-center landscape:justify-start gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] uppercase tracking-wider"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Invite
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4">
                      <InviteManager groupId={groupId} />
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMemberModalOpen(true)}
                    className="text-[10px] uppercase tracking-wider"
                  >
                    <UserCog className="w-4 h-4 mr-1" />
                    Members
                  </Button>
                </div>
              )}
            </div>

            {/* Right column - Content */}
            <div className="w-full landscape:w-[480px] landscape:shrink-0 flex flex-col gap-4">
              {errorMessage && (
                <div className="border border-destructive text-destructive text-[10px] uppercase tracking-wider px-3 py-2">
                  {errorMessage}
                </div>
              )}

              <PanelContainer enableLines>
                <div className="p-4 flex flex-col gap-6">
                  {/* Active challenges */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Active challenges ({activeChallenges.length})
                      </span>
                    </div>
                    
                    {activeChallenges.length > 0 ? (
                      <div className="max-h-[420px] overflow-y-auto pr-1">
                        <div className="grid gap-2">
                          {activeChallenges.map((challenge) => {
                            const dueStatus = getDueStatus(challenge.dueAt)
                            const hasCompleted = Boolean(
                              groupCompletions?.some((entry) => entry.challengeId === challenge._id)
                            )
                            return (
                              <div
                                key={challenge._id}
                                onClick={() => handleStartChallenge(challenge)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault()
                                    handleStartChallenge(challenge)
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                                className="relative border border-border p-3 flex flex-col gap-4 text-left hover:border-foreground/40 transition-colors md:flex-row md:items-center"
                              >
                                {isAdmin && (
                                  <button
                                    type="button"
                                    aria-label="Edit challenge"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      startEditing(challenge)
                                    }}
                                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <div className="flex flex-col gap-3 md:w-1/2">
                                  <div>
                                    <p className="text-sm text-foreground uppercase tracking-wide">
                                      {challenge.title}
                                    </p>
                                    {challenge.description && (
                                      <p className="text-[10px] text-muted-foreground/60 mt-1">{challenge.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 flex-wrap">
                                    <span className={cn(
                                      "flex items-center gap-1",
                                      dueStatus.isPast ? "text-destructive" : ""
                                    )}>
                                      <CalendarClock className="w-3 h-3" />
                                      {dueStatus.text}
                                    </span>
                                    {hasCompleted && (
                                      <span className="text-emerald-400">Completed</span>
                                    )}
                                  </div>
                                </div>
                                <div className="md:w-1/2 md:border-l md:border-border md:pl-4">
                                  <ChallengeLeaderboard challengeId={challenge._id} limit={3} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                  ) : (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                      No active challenges.
                    </p>
                  )}
                </div>

                  {/* Create challenge button - Admin only */}
                  {isAdmin && (
                    <>
                      <div className="border-t border-border" />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsChallengeModalOpen(true)}
                        className="text-[10px] uppercase tracking-wider"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Create challenge
                      </Button>
                    </>
                  )}

                  {/* Past challenges toggle */}
                  {pastChallenges.length > 0 && (
                    <>
                      <div className="border-t border-border" />
                      <button
                        type="button"
                        onClick={() => setShowPastChallenges(!showPastChallenges)}
                        className="flex items-center justify-between p-3 border border-border hover:border-foreground/40 transition-colors"
                      >
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Past challenges ({pastChallenges.length})
                        </span>
                        {showPastChallenges ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </>
                  )}

                  {/* Past challenges */}
                  {showPastChallenges && pastChallenges.length > 0 && (
                    <div className="max-h-[320px] overflow-y-auto pr-1">
                      <div className="grid gap-2">
                        {pastChallenges.map((challenge) => {
                          const dueStatus = getDueStatus(challenge.dueAt)
                          const hasCompleted = Boolean(
                            groupCompletions?.some((entry) => entry.challengeId === challenge._id)
                          )
                          return (
                            <div
                              key={challenge._id}
                              className="relative border border-border p-3 flex flex-col gap-4 text-left md:flex-row md:items-center opacity-60"
                            >
                              {isAdmin && (
                                <button
                                  type="button"
                                  aria-label="Edit challenge"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    startEditing(challenge)
                                  }}
                                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <div className="flex flex-col gap-3 md:w-1/2">
                                <div>
                                  <p className="text-sm text-foreground uppercase tracking-wide">
                                    {challenge.title}
                                  </p>
                                  {challenge.description && (
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">{challenge.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 flex-wrap">
                                  <span className={cn(
                                    "flex items-center gap-1",
                                    dueStatus.isPast ? "text-destructive" : ""
                                  )}>
                                    <CalendarClock className="w-3 h-3" />
                                    {dueStatus.text}
                                  </span>
                                  {hasCompleted && (
                                    <span className="text-emerald-400">Completed</span>
                                  )}
                                </div>
                              </div>
                               <div className="md:w-1/2 md:border-l md:border-border md:pl-4 flex flex-col gap-3">
                                <ChallengeLeaderboard challengeId={challenge._id} limit={3} />
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenCompletions(challenge._id)}
                                    className="text-[10px] uppercase tracking-wider"
                                  >
                                    Completions
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </PanelContainer>
            </div>

            {/* Responsive Modals */}
            <ResponsiveModal
              open={isMemberModalOpen}
              onOpenChange={setIsMemberModalOpen}
              title="Manage Members"
            >
              {currentUser && (
                <MemberManager
                  groupId={groupId}
                  currentUserId={currentUser._id}
                />
              )}
            </ResponsiveModal>

            <ResponsiveModal
              open={isChallengeModalOpen}
              onOpenChange={setIsChallengeModalOpen}
              title="Create Challenge"
            >
              <ChallengeForm 
                onSubmit={handleCreateChallenge}
                isSubmitting={isCreatingChallenge}
                history={playHistory}
                onSuccess={() => setIsChallengeModalOpen(false)}
              />
            </ResponsiveModal>

            <ResponsiveModal
              open={Boolean(editingChallenge)}
              onOpenChange={(open) => {
                if (!open) {
                  cancelEditing()
                }
              }}
              title="Edit Challenge"
            >
              <div className="flex flex-col gap-4">
                <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Edit challenge</h2>
                <input
                  aria-label="Challenge title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full bg-background border border-border px-3 py-2 text-[10px] uppercase tracking-wider text-foreground"
                />
                <input
                  aria-label="Challenge due date"
                  type="datetime-local"
                  value={editDueAt}
                  onChange={(e) => setEditDueAt(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2 text-[10px] uppercase tracking-wider text-foreground"
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editTitle.trim()}
                    className="text-[10px] uppercase tracking-wider"
                  >
                    Save
                  </Button>
                  {editingChallenge && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(editingChallenge)}
                      className="text-[10px] uppercase tracking-wider text-destructive border-destructive/40 hover:border-destructive hover:text-destructive"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </ResponsiveModal>
          </div>
        )}

        {showChallengeHub && selectedChallenge && (
          <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center p-4 landscape:px-8 landscape:py-3 gap-6 landscape:gap-12 max-w-lg landscape:max-w-5xl mx-auto w-full relative">
            <PageBackButton to={`/groups/${groupId}`} />
            {/* Left column: Challenge title + summary */}
            <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center gap-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                <h1
                  className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground uppercase"
                  style={{ letterSpacing: "0.1em" }}
                >
                  {selectedChallenge.title}
                </h1>
              </div>
              {selectedChallenge.description && (
                <p className="text-xs text-muted-foreground max-w-xs text-center landscape:text-left">
                  {selectedChallenge.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                <span>
                  Due {formatShortDateTime(selectedChallenge.dueAt)}
                </span>
              </div>
              {lastScore !== null && (
                <div className="border border-primary/30 px-3 py-2 text-[10px] uppercase tracking-wider text-primary">
                  Last run: {lastScore} pts
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center landscape:justify-start gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (selectedChallenge) {
                      handleOpenLeaderboard(selectedChallenge._id)
                    }
                  }}
                  className="text-[10px] uppercase tracking-wider"
                >
                  Leaderboard
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenCompletions(selectedChallenge._id)}
                  className="text-[10px] uppercase tracking-wider"
                >
                  Completions
                </Button>
              </div>
            </div>

            {/* Right column: Mixer panel + actions */}
            <div className="w-full landscape:w-[480px] landscape:shrink-0 flex flex-col gap-4">
              <PanelContainer enableLines>
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
                    disabled={Boolean(selectedChallenge.tempo)}
                  />
                  <Slider
                    value={difficultyValue}
                    onValueChange={setDifficultyValue}
                    min={0}
                    max={1}
                    step={0.01}
                    icon={Signal}
                    label="Level"
                    color={
                      difficulty === "easy"
                        ? "rgb(52, 211, 153)"
                        : difficulty === "medium"
                          ? "rgb(251, 191, 36)"
                          : "rgb(248, 113, 113)"
                    }
                    units={["EASY", "NORMAL", "HARD"]}
                    snapPoints={[0, 0.5, 1]}
                    disabled={Boolean(selectedChallenge.difficulty)}
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
                    <AmpSwitch
                      label="Practice"
                      checked={false}
                      onCheckedChange={() => {}}
                      disabled
                    />
                    <AmpSwitch
                      label="Tuplets"
                      checked={includeTuplets}
                      onCheckedChange={setIncludeTuplets}
                      disabled={selectedChallenge.tuplets !== null && selectedChallenge.tuplets !== undefined}
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
                    <PlayButton onClick={handleStartFromHub} />
                  </div>
                </div>
              </PanelContainer>
            </div>

            <ResponsiveModal
              open={isLeaderboardModalOpen}
              onOpenChange={setIsLeaderboardModalOpen}
              title="Leaderboard"
            >
              <div className="flex flex-col gap-4">
                {leaderboardChallengeId && (
                  <ChallengeLeaderboard challengeId={leaderboardChallengeId} />
                )}
              </div>
            </ResponsiveModal>

          </div>
        )}

        <ResponsiveModal
          open={isCompletionsModalOpen}
          onOpenChange={setIsCompletionsModalOpen}
          title="My completions"
        >
          <div className="flex flex-col gap-4">
            {completionsChallengeId && (
              <UserChallengeCompletions challengeId={completionsChallengeId} />
            )}
            {isAdmin && completionsChallengeId && (
              <div className="border-t border-border pt-4">
                <ChallengeCompletions challengeId={completionsChallengeId} />
              </div>
            )}
          </div>
        </ResponsiveModal>
      </main>
    </div>
  )
}
