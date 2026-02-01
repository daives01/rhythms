import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { PanelContainer } from "@/components/ui/panel-container"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export function AccountPage() {
  const navigate = useNavigate()
  const session = authClient.useSession()

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
      <main className="flex-1 flex flex-col relative overflow-x-clip overflow-y-auto">
        <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center p-4 landscape:px-8 landscape:py-3 gap-6 landscape:gap-12 max-w-lg landscape:max-w-5xl mx-auto w-full relative">
          {/* Left column - Title */}
          <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center">
            <h1
              className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground uppercase"
              style={{ letterSpacing: "0.1em" }}
            >
              Account
            </h1>
            <p className="text-xs text-muted-foreground mt-2 landscape:text-left text-center">
              Manage your authentication settings.
            </p>
          </div>

          {/* Right column - Content */}
          <div className="w-full landscape:w-[480px] landscape:shrink-0 flex flex-col gap-4">
            <div className="flex items-center justify-end">
              <Button variant="ghost" onClick={() => navigate("/")}
                className="text-[10px] uppercase tracking-wider"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </div>

            <PanelContainer>
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Signed in as</p>
                  <p className="text-sm text-foreground mt-1">{session.data.user.name ?? session.data.user.email}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => authClient.signOut()}
                  className="text-[10px] uppercase tracking-wider"
                >
                  Sign out
                </Button>
              </div>
            </PanelContainer>
          </div>
        </div>
      </main>
    </div>
  )
}
