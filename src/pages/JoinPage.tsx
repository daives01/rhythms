import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useMutation } from "convex/react"
import { ArrowLeft, Users } from "lucide-react"
import { PanelContainer } from "@/components/ui/panel-container"
import { Button } from "@/components/ui/button"
import { AuthLoading } from "@/components/auth/AuthLoading"
import { authClient } from "@/lib/auth-client"
import { api } from "../../convex/_generated/api"

export function JoinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const codeParam = searchParams.get("code")
  const session = authClient.useSession()

  const [inviteCode, setInviteCode] = useState(codeParam ?? "")
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const redeemInvite = useMutation(api.groups.redeemInvite)

  // Pre-fill code from URL
  useEffect(() => {
    if (codeParam) {
      setInviteCode(codeParam)
    }
  }, [codeParam])

  const handleRedeem = async () => {
    if (!inviteCode.trim()) return
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsRedeeming(true)
    try {
      const result = await redeemInvite({ code: inviteCode.trim().toUpperCase() })
      setSuccessMessage("You've joined the group!")
      // Redirect to group detail after a short delay
      setTimeout(() => {
        navigate(`/groups/${result.membership.groupId}`)
      }, 1500)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to join group.")
    } finally {
      setIsRedeeming(false)
    }
  }

  if (session.isPending) {
    return <AuthLoading />
  }

  // If not logged in, show auth prompt
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
                <div className="flex items-center gap-2">
                  <Users className="w-6 h-6 text-muted-foreground" />
                  <h1 className="text-xl uppercase tracking-widest text-foreground">Join Group</h1>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  You've been invited to join a rhythm group. Sign in or create an account to continue.
                </p>

                {codeParam && (
                  <div className="border border-border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Invite code</p>
                    <code className="text-lg text-foreground">{codeParam.toUpperCase()}</code>
                  </div>
                )}

                <Button onClick={() => navigate("/account")} className="w-full">
                  Sign In or Create Account
                </Button>

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
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 max-w-md mx-auto w-full">
          <PanelContainer className="w-full">
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-muted-foreground" />
                <h1 className="text-xl uppercase tracking-widest text-foreground">Join Group</h1>
              </div>

              <p className="text-sm text-muted-foreground">
                Enter an invite code to join a rhythm group.
              </p>

              {errorMessage && (
                <div className="border border-destructive text-destructive text-[10px] uppercase tracking-wider px-3 py-2">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="border border-emerald-400 text-emerald-400 text-[10px] uppercase tracking-wider px-3 py-2">
                  {successMessage}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <input
                  aria-label="Invite code"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="ENTER INVITE CODE"
                  autoCapitalize="characters"
                  className="w-full bg-background border border-border px-3 py-3 text-sm text-foreground text-center tracking-wider placeholder:text-muted-foreground/50"
                />
                <Button
                  onClick={handleRedeem}
                  disabled={isRedeeming || !inviteCode.trim()}
                  className="w-full"
                >
                  {isRedeeming ? "Joining..." : "Join Group"}
                </Button>
              </div>

              <button
                className="text-[10px] uppercase tracking-wider text-muted-foreground/50 hover:text-foreground transition-colors"
                onClick={() => navigate("/account")}
              >
                <ArrowLeft className="w-3 h-3 inline mr-1" />
                Back to account
              </button>
            </div>
          </PanelContainer>
        </div>
      </main>
    </div>
  )
}
