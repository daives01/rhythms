import { useState, type FormEvent } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { PanelContainer } from "@/components/ui/panel-container"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (!token) {
      setError("Invalid reset link")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (result.error) {
        setError(result.error.message ?? "Reset failed")
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
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
                <h1 className="text-xl uppercase tracking-widest text-foreground">Invalid Link</h1>
                <p className="text-xs text-muted-foreground">
                  This password reset link is invalid or has expired.
                </p>
                <button
                  className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => navigate("/account")}
                >
                  Back to sign in
                </button>
              </div>
            </PanelContainer>
          </div>
        </main>
      </div>
    )
  }

  if (success) {
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
                <h1 className="text-xl uppercase tracking-widest text-foreground">Password Reset</h1>
                <p className="text-xs text-muted-foreground">
                  Your password has been reset successfully.
                </p>
                <Button onClick={() => navigate("/account")} className="w-full">
                  Sign In
                </Button>
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
              <h1 className="text-xl uppercase tracking-widest text-foreground">New Password</h1>
              <p className="text-xs text-muted-foreground">
                Enter your new password below.
              </p>

              {error && (
                <div className="border border-destructive text-destructive text-[10px] uppercase tracking-wider px-3 py-2">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                  type="password"
                  placeholder="New password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
                />
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>

              <button
                className="text-[10px] uppercase tracking-wider text-muted-foreground/50 hover:text-foreground transition-colors"
                onClick={() => navigate("/account")}
              >
                Back to sign in
              </button>
            </div>
          </PanelContainer>
        </div>
      </main>
    </div>
  )
}
