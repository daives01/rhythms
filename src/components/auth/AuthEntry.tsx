import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useMutation } from "convex/react"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { api } from "../../../convex/_generated/api"

export function AuthEntry() {
  const location = useLocation()
  const navigate = useNavigate()
  const session = authClient.useSession()
  const getOrCreateUser = useMutation(api.users.getOrCreateUser)
  const hasEnsuredUser = useRef(false)
  const [open, setOpen] = useState(false)
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
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              navigate("/account")
            }}
            className={cn(
              "w-full text-left px-3 py-2 text-[10px] uppercase tracking-wider",
              "text-muted-foreground hover:text-foreground hover:bg-background/40",
              "transition-colors"
            )}
          >
            Account
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
    </div>
  )
}
