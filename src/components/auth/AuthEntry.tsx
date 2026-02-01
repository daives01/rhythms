import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useMutation, useQuery } from "convex/react"
import { Plus } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ResponsiveModal } from "@/components/ui/responsive-modal"
import { api } from "../../../convex/_generated/api"

export function AuthEntry() {
  const location = useLocation()
  const navigate = useNavigate()
  const session = authClient.useSession()
  const authSession = useQuery(api.users.getAuthSession, session.data ? {} : "skip")
  const getOrCreateUser = useMutation(api.users.getOrCreateUser)
  const createGroup = useMutation(api.groups.create)
  const hasEnsuredUser = useRef(false)
  const [open, setOpen] = useState(false)
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [createGroupError, setCreateGroupError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!session.data) {
      hasEnsuredUser.current = false
      return
    }

    if (hasEnsuredUser.current) return
    hasEnsuredUser.current = true
    getOrCreateUser().catch(() => {
      hasEnsuredUser.current = false
    })
  }, [getOrCreateUser, session.data])

  useEffect(() => {
    if (!open) return
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener("mousedown", handleClick)
    return () => window.removeEventListener("mousedown", handleClick)
  }, [open])

  if (location.pathname === "/play") {
    return null
  }

  const user = session.data?.user
  const displayName = user?.name ?? user?.email ?? "Account"
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    setCreateGroupError(null)
    setIsCreatingGroup(true)
    try {
      const result = await createGroup({ name: newGroupName.trim() })
      setNewGroupName("")
      setIsCreateGroupOpen(false)
      navigate(`/groups/${result.group._id}`)
    } catch (error) {
      setCreateGroupError(error instanceof Error ? error.message : "Unable to create group.")
    } finally {
      setIsCreatingGroup(false)
    }
  }

  return (
    <div ref={containerRef} className="fixed top-4 right-4 z-50">
      <button
        type="button"
        onClick={() => {
          if (!session.data) {
            navigate("/account")
            return
          }
          setOpen((prev) => !prev)
        }}
        className={cn(
          "flex items-center gap-2 px-3 py-2 border border-border",
          "bg-muted text-[10px] uppercase tracking-wider",
          "text-muted-foreground hover:text-foreground hover:border-foreground/40",
          "transition-colors"
        )}
      >
        {session.data && (
          <span className="w-6 h-6 border border-border bg-background text-foreground flex items-center justify-center text-[10px]">
            {initials || "U"}
          </span>
        )}
        <span>{session.data ? displayName : "Sign in"}</span>
      </button>

      {session.data && open && (
        <div className="absolute right-0 mt-2 w-44 border border-border bg-muted shadow-[0_6px_18px_rgba(0,0,0,0.5)]">
          {authSession?.premium && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setCreateGroupError(null)
                setIsCreateGroupOpen(true)
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-[10px] uppercase tracking-wider",
                "text-muted-foreground hover:text-foreground hover:bg-background/40",
                "transition-colors"
              )}
            >
              Create group
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              navigate("/history")
            }}
            className={cn(
              "w-full text-left px-3 py-2 text-[10px] uppercase tracking-wider",
              "text-muted-foreground hover:text-foreground hover:bg-background/40",
              "transition-colors border-t border-border"
            )}
          >
            History
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              authClient.signOut()
            }}
            className={cn(
              "w-full text-left px-3 py-2 text-[10px] uppercase tracking-wider",
              "text-muted-foreground hover:text-foreground hover:bg-background/40",
              "transition-colors border-t border-border"
            )}
          >
            Sign out
          </button>
        </div>
      )}

      {session.data && authSession?.premium && (
        <ResponsiveModal
          open={isCreateGroupOpen}
          onOpenChange={setIsCreateGroupOpen}
          title="Create group"
        >
          <div className="flex flex-col gap-4">
            {createGroupError && (
              <div className="border border-destructive text-destructive text-[10px] uppercase tracking-wider px-3 py-2">
                {createGroupError}
              </div>
            )}
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
        </ResponsiveModal>
      )}
    </div>
  )
}
