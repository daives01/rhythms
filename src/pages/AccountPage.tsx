import { useMemo, useState, type FormEvent } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useMutation, useQuery } from "convex/react"
import { ArrowLeft, CalendarClock, Plus, Users } from "lucide-react"
import { PanelContainer } from "@/components/ui/panel-container"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { encodeChallenge, generateSeed, type ChallengeData } from "@/lib/random"
import { api } from "../../convex/_generated/api"

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

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
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

const difficultyValueMap: Record<string, number> = {
  easy: 0,
  medium: 0.5,
  hard: 1,
}

type GroupListEntry = {
  group: {
    _id: string
    name: string
    createdAt: number
    createdBy: string
  }
  membership: {
    _id: string
    role: "admin" | "member"
  }
}

export function AccountPage() {
  const navigate = useNavigate()
  const session = authClient.useSession()
  const [searchParams] = useSearchParams()
  const assignmentParam = searchParams.get("assignment")
  const assignmentId = assignmentParam ?? undefined

  const groups = useQuery(api.groups.listForUser, session.data ? {} : "skip") as GroupListEntry[] | undefined
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const selectedGroup = useMemo(() => {
    if (!groups || groups.length === 0) return null
    const firstGroup = groups[0]
    if (!selectedGroupId) return firstGroup
    return groups.find((entry) => entry.group._id === selectedGroupId) ?? firstGroup
  }, [groups, selectedGroupId])

  const assignments = useQuery(
    api.assignments.listForGroup,
    selectedGroup ? { groupId: selectedGroup.group._id, includePast: true } : "skip"
  )
  const assignment = useQuery(
    api.assignments.get,
    assignmentId ? { assignmentId } : "skip"
  )
  const leaderboard = useQuery(
    api.playHistory.listForAssignment,
    assignmentId && assignment?.leaderboard ? { assignmentId } : "skip"
  )
  const history = useQuery(api.playHistory.listForUser, session.data ? { limit: 10 } : "skip")

  const createGroup = useMutation(api.groups.create)
  const createAssignment = useMutation(api.assignments.create)

  const [newGroupName, setNewGroupName] = useState("")
  const [newAssignmentTitle, setNewAssignmentTitle] = useState("")
  const [newAssignmentDueAt, setNewAssignmentDueAt] = useState("")
  const [newAssignmentTempo, setNewAssignmentTempo] = useState(120)
  const [newAssignmentDifficulty, setNewAssignmentDifficulty] = useState("medium")
  const [newAssignmentLeaderboard, setNewAssignmentLeaderboard] = useState(true)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const includeTuplets = loadTupletsSetting()

  const handleStartAssignment = (source: { tempo?: number | null; difficulty?: string | null; seed?: string | null }) => {
    const difficultyValue = source.difficulty ? difficultyValueMap[source.difficulty] ?? 0.5 : 0.5
    const challenge: ChallengeData = {
      seed: source.seed ?? generateSeed(),
      bpm: source.tempo ?? 120,
      difficulty: difficultyValue,
      tuplets: includeTuplets,
    }
    const encoded = encodeChallenge(challenge)
    navigate(`/play?challenge=${encoded}`, { state: { audioUnlocked: true } })
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    setErrorMessage(null)
    setIsCreatingGroup(true)
    try {
      const result = await createGroup({ name: newGroupName.trim() })
      setNewGroupName("")
      setSelectedGroupId(result.group._id)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create group.")
    } finally {
      setIsCreatingGroup(false)
    }
  }

  const handleCreateAssignment = async () => {
    if (!selectedGroup) return
    if (!newAssignmentTitle.trim() || !newAssignmentDueAt) return
    setErrorMessage(null)
    setIsCreatingAssignment(true)
    try {
      await createAssignment({
        groupId: selectedGroup.group._id,
        title: newAssignmentTitle.trim(),
        dueAt: new Date(newAssignmentDueAt).getTime(),
        tempo: newAssignmentTempo,
        difficulty: newAssignmentDifficulty,
        leaderboard: newAssignmentLeaderboard,
      })
      setNewAssignmentTitle("")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create assignment.")
    } finally {
      setIsCreatingAssignment(false)
    }
  }

  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up" | "forgot-password">("sign-in")
  const [authEmail, setAuthEmail] = useState("")
  const [authIdentifier, setAuthIdentifier] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authName, setAuthName] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSuccess, setAuthSuccess] = useState<string | null>(null)
  const hasIdentifier = authIdentifier.trim().length > 0

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    const identifier = authIdentifier.trim()
    try {
      const result = identifier.includes("@")
        ? await authClient.signIn.email({
            email: identifier,
            password: authPassword,
          })
        : await authClient.signIn.username({
            username: identifier,
            password: authPassword,
          })
      if (result.error) {
        setAuthError(result.error.message ?? "Sign in failed")
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign in failed")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    setAuthSuccess(null)
    try {
      const result = await authClient.signUp.email({
        email: authEmail,
        password: authPassword,
        name: authName.trim(),
        username: authName.trim(),
      })
      if (result.error) {
        setAuthError(result.error.message ?? "Sign up failed")
      } else {
        setAuthSuccess("Check your email for a verification link.")
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign up failed")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    setAuthSuccess(null)
    try {
      const result = await authClient.requestPasswordReset({
        email: authEmail,
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (result.error) {
        setAuthError(result.error.message ?? "Request failed")
      } else {
        setAuthSuccess("If an account exists, you'll receive a reset email.")
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setAuthLoading(false)
    }
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
        <main className="flex-1 flex flex-col relative overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 max-w-md mx-auto w-full">
            <PanelContainer className="w-full">
              <div className="p-6 flex flex-col gap-4">
                <h1 className="text-xl uppercase tracking-widest text-foreground">
                  {authMode === "sign-in" && "Sign In"}
                  {authMode === "sign-up" && "Create Account"}
                  {authMode === "forgot-password" && "Reset Password"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {authMode === "forgot-password" && "Enter your email to receive a reset link."}
                </p>

                {authError && (
                  <div className="border border-destructive text-destructive text-[10px] uppercase tracking-wider px-3 py-2">
                    {authError}
                  </div>
                )}
                {authSuccess && (
                  <div className="border border-foreground/20 text-foreground text-[10px] uppercase tracking-wider px-3 py-2">
                    {authSuccess}
                  </div>
                )}

                <form
                  onSubmit={
                    authMode === "sign-in"
                      ? handleSignIn
                      : authMode === "sign-up"
                        ? handleSignUp
                        : handleForgotPassword
                  }
                  className="flex flex-col gap-3"
                >
                  {authMode === "sign-in" && (
                    <input
                      type="text"
                      placeholder="Email or username"
                      required
                      value={authIdentifier}
                      onChange={(e) => setAuthIdentifier(e.target.value)}
                      className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
                    />
                  )}
                  {authMode === "sign-up" && (
                    <input
                      type="text"
                      placeholder="Username"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
                    />
                  )}
                  {authMode !== "sign-in" && (
                    <input
                      type="email"
                      placeholder="Email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
                    />
                  )}
                  {authMode !== "forgot-password" && (
                    <input
                      type="password"
                      placeholder="Password"
                      required
                      minLength={8}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
                    />
                  )}
                  <Button
                    type="submit"
                    disabled={authLoading || (authMode === "sign-in" && !hasIdentifier)}
                    className="w-full"
                  >
                    {authLoading
                      ? "Loading..."
                      : authMode === "sign-in"
                        ? "Sign In"
                        : authMode === "sign-up"
                          ? "Create Account"
                          : "Send Reset Link"}
                  </Button>
                </form>

                <div className="flex flex-col gap-2 text-center">
                  {authMode === "sign-in" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("sign-up")
                          setAuthError(null)
                          setAuthSuccess(null)
                        }}
                        className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Create account
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("forgot-password")
                          setAuthError(null)
                          setAuthSuccess(null)
                        }}
                        className="text-[10px] uppercase tracking-wider text-muted-foreground/50 hover:text-foreground transition-colors"
                      >
                        Forgot password?
                      </button>
                    </>
                  )}
                  {(authMode === "sign-up" || authMode === "forgot-password") && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("sign-in")
                        setAuthError(null)
                        setAuthSuccess(null)
                      }}
                      className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Back to sign in
                    </button>
                  )}
                </div>

                <button
                  className="text-[10px] uppercase tracking-wider text-muted-foreground/50 hover:text-foreground transition-colors"
                  onClick={() => navigate("/")}
                >
                  Back to play
                </button>
              </div>
            </PanelContainer>
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
      <main className="flex-1 flex flex-col relative overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl uppercase tracking-widest text-foreground">Account</h1>
              <p className="text-xs text-muted-foreground/60 mt-2">
                Manage groups, assignments, and recent plays.
              </p>
            </div>
            <Button variant="ghost" onClick={() => navigate("/")}
              className="text-[10px] uppercase tracking-wider"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>

          {errorMessage && (
            <div className="border border-destructive text-destructive text-[10px] uppercase tracking-wider px-3 py-2">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
            <PanelContainer>
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Signed in as</p>
                  <p className="text-sm text-foreground mt-1">{session.data.user.name ?? session.data.user.email}</p>
                </div>
                <div className="border-t border-border pt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Groups</span>
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {groups?.length ? (
                      groups.map((entry) => (
                        <button
                          key={entry.group._id}
                          type="button"
                          onClick={() => setSelectedGroupId(entry.group._id)}
                          className={cn(
                            "flex items-center justify-between px-2 py-2 border border-border text-[10px] uppercase tracking-wider",
                            selectedGroup?.group._id === entry.group._id
                              ? "text-foreground bg-background"
                              : "text-muted-foreground hover:text-foreground hover:border-foreground/40"
                          )}
                        >
                          <span>{entry.group.name}</span>
                          <span className="text-[9px] text-muted-foreground/60">
                            {entry.membership.role === "admin" ? "Admin" : "Member"}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                        No groups yet
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      aria-label="Group name"
                      value={newGroupName}
                      onChange={(event) => setNewGroupName(event.target.value)}
                      placeholder="Group name"
                      className="w-full bg-background border border-border px-2 py-2 text-[10px] uppercase tracking-wider text-foreground"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCreateGroup}
                      disabled={isCreatingGroup || !newGroupName.trim()}
                      className="text-[10px] uppercase tracking-wider"
                    >
                      <Plus className="w-4 h-4" />
                      Create group
                    </Button>
                  </div>
                </div>
              </div>
            </PanelContainer>

            <div className="flex flex-col gap-6">
              <PanelContainer>
                <div className="p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Assignments</h2>
                    {selectedGroup && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
                        {selectedGroup.group.name}
                      </span>
                    )}
                  </div>
                  {assignments?.length ? (
                    <div className="grid gap-3">
                      {assignments.map((entry) => (
                        <div key={entry._id} className="border border-border p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-foreground">{entry.title}</p>
                              {entry.description && (
                                <p className="text-[10px] text-muted-foreground/60">{entry.description}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate(`/account?assignment=${entry._id}`)}
                              className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                            >
                              View
                            </button>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                            <span className="flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" />
                              {formatDateTime(entry.dueAt)}
                            </span>
                            <span>{entry.tempo ? `${entry.tempo} bpm` : "Any tempo"}</span>
                            <span>{formatDifficultyLabel(entry.difficulty)}</span>
                            {entry.leaderboard ? "Leaderboard" : "No leaderboard"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                      No assignments yet.
                    </p>
                  )}

                  {selectedGroup?.membership.role === "admin" && (
                    <div className="border-t border-border pt-4 flex flex-col gap-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Create assignment</p>
                      <input
                        aria-label="Assignment title"
                        value={newAssignmentTitle}
                        onChange={(event) => setNewAssignmentTitle(event.target.value)}
                        placeholder="Title"
                        className="w-full bg-background border border-border px-2 py-2 text-[10px] uppercase tracking-wider text-foreground"
                      />
                      <input
                        aria-label="Assignment due date"
                        type="datetime-local"
                        value={newAssignmentDueAt}
                        onChange={(event) => setNewAssignmentDueAt(event.target.value)}
                        className="w-full bg-background border border-border px-2 py-2 text-[10px] uppercase tracking-wider text-foreground"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          aria-label="Assignment tempo"
                          type="number"
                          min={40}
                          max={220}
                          value={newAssignmentTempo}
                          onChange={(event) => setNewAssignmentTempo(Number(event.target.value))}
                          className="w-full bg-background border border-border px-2 py-2 text-[10px] uppercase tracking-wider text-foreground"
                          placeholder="Tempo"
                        />
                        <select
                          aria-label="Assignment difficulty"
                          value={newAssignmentDifficulty}
                          onChange={(event) => setNewAssignmentDifficulty(event.target.value)}
                          className="w-full bg-background border border-border px-2 py-2 text-[10px] uppercase tracking-wider text-foreground"
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={newAssignmentLeaderboard}
                          onChange={(event) => setNewAssignmentLeaderboard(event.target.checked)}
                        />
                        Enable leaderboard
                      </label>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCreateAssignment}
                        disabled={isCreatingAssignment || !newAssignmentTitle.trim() || !newAssignmentDueAt}
                        className="text-[10px] uppercase tracking-wider"
                      >
                        <Plus className="w-4 h-4" />
                        Create assignment
                      </Button>
                    </div>
                  )}
                </div>
              </PanelContainer>

              {assignment && (
                <PanelContainer>
                  <div className="p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">Assignment detail</p>
                        <h3 className="text-lg text-foreground mt-1">{assignment.title}</h3>
                      </div>
                      {assignment.leaderboard && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
                          Leaderboard
                        </span>
                      )}
                    </div>
                    {assignment.description && (
                      <p className="text-xs text-muted-foreground">{assignment.description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      <span>Due {formatDateTime(assignment.dueAt)}</span>
                      <span>Tempo {assignment.tempo ?? "Any"}</span>
                      <span>Difficulty {formatDifficultyLabel(assignment.difficulty)}</span>
                      <span>Seed {assignment.seed ?? "Generated"}</span>
                    </div>
                    <Button
                      onClick={() => handleStartAssignment(assignment)}
                      className="w-full"
                    >
                      Start assignment
                    </Button>
                    {!assignment.leaderboard && (
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                        Leaderboard disabled for this assignment.
                      </p>
                    )}
                    {assignment.leaderboard && leaderboard && (
                      <div className="border-t border-border pt-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Leaderboard</p>
                        {leaderboard.length ? (
                          <div className="mt-3 grid gap-2">
                            {leaderboard.slice(0, 5).map((entry) => (
                              <div
                                key={entry._id}
                                className="flex items-center justify-between text-[10px] uppercase tracking-wider"
                              >
                                <span className="text-muted-foreground">{formatShortDate(entry.createdAt)}</span>
                                <span className="text-foreground tabular-nums">{entry.score}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mt-2">
                            No scores yet.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </PanelContainer>
              )}

              <PanelContainer>
                <div className="p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs uppercase tracking-widest text-muted-foreground">History</h2>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Recent runs</span>
                  </div>
                  {history?.length ? (
                    <div className="grid gap-3">
                      {history.map((entry) => {
                        const challenge: ChallengeData = {
                          seed: entry.seed,
                          bpm: entry.tempo,
                          difficulty: difficultyValueMap[entry.difficulty] ?? 0.5,
                          tuplets: includeTuplets,
                        }
                        const encoded = encodeChallenge(challenge)
                        return (
                          <div
                            key={entry._id}
                            className="border border-border p-3 flex items-center justify-between text-[10px] uppercase tracking-wider"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="text-foreground">{entry.score} pts</span>
                              <span className="text-muted-foreground/60">
                                {formatShortDate(entry.createdAt)} · {entry.tempo} bpm · {formatDifficultyLabel(entry.difficulty)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate(`/play?challenge=${encoded}`, { state: { audioUnlocked: true } })}
                              className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                            >
                              Replay
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                      No history yet.
                    </p>
                  )}
                </div>
              </PanelContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
