import { useState } from "react"
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom"
import { useMutation, useQuery, useConvex } from "convex/react"
import { CalendarClock, Plus, UserPlus, UserCog, ChevronUp, ChevronDown, Trophy } from "lucide-react"
import { PanelContainer } from "@/components/ui/panel-container"
import { Button } from "@/components/ui/button"
import { PageBackButton } from "@/components/ui/page-back-button"
import { AuthLoading } from "@/components/auth/AuthLoading"
import { useEnsureUser } from "@/lib/useEnsureUser"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const SETTINGS_KEY = "rhythm-settings"

function loadTupletsSetting(): boolean {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (!stored) return false
    const parsed = JSON.parse(stored)
    return parsed.includeTuplets ?? false
  } catch {
    return false
  }
}

function formatShortDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function formatDifficultyLabel(value?: string | null): string {
  if (!value) return "Any"
  return value.charAt(0).toUpperCase() + value.slice(1)
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

const difficultyValueMap: Record<string, number> = {
  easy: 0,
  medium: 0.5,
  hard: 1,
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
  leaderboard: boolean
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
    leaderboard: boolean
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
  const [leaderboard, setLeaderboard] = useState(false)
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
    date.setHours(18, 0, 0, 0)
    setDueAt(date.toISOString().slice(0, 16))
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
      leaderboard,
    })
    
    onSuccess()
    setTitle("")
    setDueAt("")
    setTempo(120)
    setDifficulty("medium")
    setTupletsEnabled(false)
    setLeaderboard(false)
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

      <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <input
          type="checkbox"
          checked={leaderboard}
          onChange={(e) => setLeaderboard(e.target.checked)}
          className="w-4 h-4"
        />
        Enable leaderboard
      </label>
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
  const { isReady: isUserReady } = useEnsureUser()
  const convex = useConvex()
  
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
  const [editTempo, setEditTempo] = useState(120)
  const [editDifficulty, setEditDifficulty] = useState("medium")
  const [editTuplets, setEditTuplets] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const includeTuplets = loadTupletsSetting()
  const isAdmin = groupDetail?.membership.role === "admin"

  const now = Date.now()
  const activeChallenges = groupDetail?.challenges.filter((c) => c.dueAt >= now) ?? []
  const pastChallenges = groupDetail?.challenges.filter((c) => c.dueAt < now) ?? []

  const handleStartChallenge = (challenge: ChallengeEntry) => {
    const difficultyValue = challenge.difficulty ? difficultyValueMap[challenge.difficulty] ?? 0.5 : 0.5
    const challengeTuplets = challenge.tuplets ?? includeTuplets
    const challengeData: ChallengeData = {
      seed: challenge.seed ?? generateSeed(),
      bpm: challenge.tempo ?? 120,
      difficulty: difficultyValue,
      tuplets: challengeTuplets,
      groupId: challenge.groupId,
      challengeId: challenge._id,
    }
    const encoded = encodeChallenge(challengeData)
    navigate(`/play?challenge=${encoded}`, { state: { audioUnlocked: true } })
  }

  const handleCreateChallenge = async (data: {
    title: string
    dueAt: number
    tempo?: number
    difficulty?: string
    seed?: string
    tuplets?: boolean
    leaderboard: boolean
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
        leaderboard: data.leaderboard,
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
    setEditDueAt(new Date(challenge.dueAt).toISOString().slice(0, 16))
    setEditTempo(challenge.tempo ?? 120)
    setEditDifficulty(challenge.difficulty ?? "medium")
    setEditTuplets(challenge.tuplets ?? false)
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
        tempo: editTempo,
        difficulty: editDifficulty,
        tuplets: editTuplets,
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

  if (session.isPending || (session.data && !isUserReady)) {
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

  const selectedChallenge =
    challengeId && challengeDetail?.groupId === groupId
      ? challengeDetail
      : null
  const showChallengeHub = Boolean(selectedChallenge)

  const handleStartFromHub = () => {
    if (!selectedChallenge) return
    const difficultyValue = selectedChallenge.difficulty
      ? difficultyValueMap[selectedChallenge.difficulty] ?? 0.5
      : 0.5
    const challengeTuplets = selectedChallenge.tuplets ?? includeTuplets
    const challengeData: ChallengeData = {
      seed: selectedChallenge.seed ?? generateSeed(),
      bpm: selectedChallenge.tempo ?? 120,
      difficulty: difficultyValue,
      tuplets: challengeTuplets,
      groupId: selectedChallenge.groupId,
      challengeId: selectedChallenge._id,
    }
    transportEngine.unlockAudio()
    const encoded = encodeChallenge(challengeData)
    navigate(`/play?challenge=${encoded}`, { state: { audioUnlocked: true } })
  }

  const locationState = location.state as { score?: GameScore; finalScore?: number } | null
  const lastScore = locationState?.finalScore
    ?? (locationState?.score
      ? Math.round(locationState.score.totalHits)
      : null)

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
                              <div key={challenge._id} className="border border-border p-3 flex flex-col gap-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="text-sm text-foreground uppercase tracking-wide">
                                      {challenge.title}
                                    </p>
                                    {challenge.description && (
                                      <p className="text-[10px] text-muted-foreground/60 mt-1">{challenge.description}</p>
                                    )}
                                  </div>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => startEditing(challenge)}
                                      className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                                    >
                                      Edit
                                    </button>
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
                                  <span>{challenge.tempo ? `${challenge.tempo} bpm` : "Any tempo"}</span>
                                  <span>{formatDifficultyLabel(challenge.difficulty)}</span>
                                  <span>{challenge.tuplets ? "Tuplets on" : "Tuplets off"}</span>
                                  {hasCompleted && (
                                    <span className="text-emerald-400">Completed</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleStartChallenge(challenge)}
                                    className="text-[10px] uppercase tracking-wider"
                                  >
                                    Start challenge
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onMouseEnter={() => {
                                      if (session.data) {
                                        void convex.query(api.challenges.get, {
                                          challengeId: challenge._id,
                                        })
                                      }
                                    }}
                                    onFocus={() => {
                                      if (session.data) {
                                        void convex.query(api.challenges.get, {
                                          challengeId: challenge._id,
                                        })
                                      }
                                    }}
                                    onClick={() => navigate(`/groups/${groupId}?challenge=${challenge._id}`)}
                                    className="text-[10px] uppercase tracking-wider"
                                  >
                                    View details
                                  </Button>
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
                          {pastChallenges.map((challenge) => (
                            <div key={challenge._id} className="border border-border p-3 flex flex-col gap-2 opacity-60">
                              <div className="flex items-start justify-between">
                                <p className="text-sm text-foreground uppercase tracking-wide">{challenge.title}</p>
                                {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => startEditing(challenge)}
                                  className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                                >
                                  Edit
                                </button>
                              )}
                              </div>
                              <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 flex-wrap">
                                <span className="text-destructive">Past due</span>
                                <span>Ended {formatShortDate(challenge.dueAt)}</span>
                                <span>{challenge.tempo ? `${challenge.tempo} bpm` : "Any tempo"}</span>
                                <span>{formatDifficultyLabel(challenge.difficulty)}</span>
                                <span>{challenge.tuplets ? "Tuplets on" : "Tuplets off"}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Edit challenge panel */}
                  {editingChallenge && (
                    <>
                      <div className="border-t border-border" />
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Edit challenge</h2>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={cancelEditing}
                              className="text-muted-foreground hover:text-foreground text-[10px] uppercase tracking-wider"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(editingChallenge)}
                              className="text-destructive hover:text-destructive/80 text-[10px] uppercase tracking-wider"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
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
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            aria-label="Challenge tempo"
                            type="number"
                            min={40}
                            max={220}
                            value={editTempo}
                            onChange={(e) => setEditTempo(Number(e.target.value))}
                            className="w-full bg-background border border-border px-3 py-2 text-[10px] uppercase tracking-wider text-foreground"
                            placeholder="Tempo"
                          />
                          <select
                            aria-label="Challenge difficulty"
                            value={editDifficulty}
                            onChange={(e) => setEditDifficulty(e.target.value)}
                            className="w-full bg-background border border-border px-3 py-2 text-[10px] uppercase tracking-wider text-foreground"
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                        <label className="flex items-center justify-between border border-border px-3 py-2 text-[10px] uppercase tracking-wider">
                          <span className="text-muted-foreground">Tuplets</span>
                          <input
                            type="checkbox"
                            checked={editTuplets}
                            onChange={(e) => setEditTuplets(e.target.checked)}
                            className="w-4 h-4"
                          />
                        </label>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={isSaving || !editTitle.trim()}
                          className="text-[10px] uppercase tracking-wider"
                        >
                          Save changes
                        </Button>
                      </div>
                    </>
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
              {session.data && (
                <MemberManager 
                  groupId={groupId} 
                  currentUserId={session.data.user.id as Id<"users">}
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
                <span>{selectedChallenge.tempo ? `${selectedChallenge.tempo} bpm` : "Any tempo"}</span>
                <span>{formatDifficultyLabel(selectedChallenge.difficulty)}</span>
                <span>
                  Due {formatShortDate(selectedChallenge.dueAt)}
                </span>
              </div>
              {lastScore !== null && (
                <div className="border border-primary/30 px-3 py-2 text-[10px] uppercase tracking-wider text-primary">
                  Last run: {lastScore} pts
                </div>
              )}
            </div>

            {/* Right column: Leaderboard + actions */}
            <div className="w-full landscape:w-[480px] landscape:shrink-0 flex flex-col gap-4">
              <PanelContainer enableLines>
                <div className="p-4 flex flex-col gap-4">
                  {selectedChallenge.leaderboard ? (
                    <ChallengeLeaderboard challengeId={selectedChallenge._id} />
                  ) : (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                      Leaderboard is disabled for this challenge.
                    </p>
                  )}
                  <div className="border-t border-border pt-4">
                    <UserChallengeCompletions challengeId={selectedChallenge._id} />
                  </div>
                  {isAdmin && (
                    <div className="border-t border-border pt-4">
                      <ChallengeCompletions challengeId={selectedChallenge._id} />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleStartFromHub}
                      className="text-[10px] uppercase tracking-wider"
                    >
                      Start challenge
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/groups/${groupId}`)}
                      className="text-[10px] uppercase tracking-wider"
                    >
                      Back to group
                    </Button>
                  </div>
                </div>
              </PanelContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
