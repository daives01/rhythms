import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useMutation, useQuery } from "convex/react"
import { Plus, Users } from "lucide-react"
import { PanelContainer } from "@/components/ui/panel-container"
import { Button } from "@/components/ui/button"
import { PageBackButton } from "@/components/ui/page-back-button"
import { AuthLoading } from "@/components/auth/AuthLoading"
import { useEnsureUser } from "@/lib/useEnsureUser"
import { authClient } from "@/lib/auth-client"
import { buildAuthSearch, getReturnToFromLocation } from "@/lib/auth-redirect"
import { cn } from "@/lib/utils"
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
}

interface ChallengeEntry {
  _id: Id<"challenges">
  groupId: Id<"groups">
}

export function GroupsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const session = authClient.useSession()
  const { isReady: isUserReady } = useEnsureUser()
  const groups = useQuery(api.groups.listForUser, session.data ? {} : "skip") as GroupListEntry[] | undefined
  const challenges = useQuery(api.challenges.listForUser, session.data ? {} : "skip") as ChallengeEntry[] | undefined
  const authSession = useQuery(api.users.getAuthSession, session.data ? {} : "skip")
  
  const createGroup = useMutation(api.groups.create)

  const [newGroupName, setNewGroupName] = useState("")
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    setErrorMessage(null)
    setIsCreatingGroup(true)
    try {
      const result = await createGroup({ name: newGroupName.trim() })
      setNewGroupName("")
      navigate(`/groups/${result.group._id}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create group.")
    } finally {
      setIsCreatingGroup(false)
    }
  }

  const getChallengeCount = (groupId: Id<"groups">): number => {
    return challenges?.filter((c) => c.groupId === groupId).length ?? 0
  }

  const isPremium = Boolean(authSession?.premium)

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
                Groups
              </h1>
              <p className="text-xs text-muted-foreground mt-2 landscape:text-left text-center">
                Sign in to view and manage your groups.
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
              Groups
            </h1>
            <p className="text-xs text-muted-foreground mt-2 landscape:text-left text-center">
              Your groups and challenges
            </p>
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
                {isPremium && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Create new group</span>
                    </div>
                    <input
                      aria-label="Group name"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Group name"
                      className="w-full bg-background border border-border px-3 py-2 text-[10px] uppercase tracking-wider text-foreground"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCreateGroup}
                      disabled={isCreatingGroup || !newGroupName.trim()}
                      className="text-[10px] uppercase tracking-wider"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create group
                    </Button>
                  </div>
                )}

                <div className="border-t border-border" />

                {/* Group list */}
                <div className="flex flex-col gap-3">
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
                          onClick={() => navigate(`/groups/${entry.group._id}`)}
                          className={cn(
                            "border border-border p-3 text-left",
                            "hover:border-foreground/40 transition-colors"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">{entry.group.name}</span>
                            <span className={cn(
                              "text-[9px] uppercase tracking-wider px-2 py-0.5 border",
                              entry.membership.role === "admin"
                                ? "border-foreground/40 text-foreground"
                                : "border-border text-muted-foreground"
                            )}>
                              {entry.membership.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                            <span>{getChallengeCount(entry.group._id)} challenges</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                      {isPremium ? "No groups yet. Create one." : "No groups yet."}
                    </p>
                  )}
                </div>

              </div>
            </PanelContainer>
          </div>
        </div>
      </main>
    </div>
  )
}
