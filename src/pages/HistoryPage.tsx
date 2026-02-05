import { useLocation, useNavigate } from "react-router-dom"
import { usePaginatedQuery } from "convex/react"
import { PanelContainer } from "@/components/ui/panel-container"
import { Button } from "@/components/ui/button"
import { PageBackButton } from "@/components/ui/page-back-button"
import { AuthLoading } from "@/components/auth/AuthLoading"
import { useEnsureUser } from "@/lib/useEnsureUser"
import { authClient } from "@/lib/auth-client"
import { encodeChallenge, type ChallengeData } from "@/lib/random"
import { buildAuthSearch, getReturnToFromLocation } from "@/lib/auth-redirect"
import { loadSettings } from "@/lib/settings"
import { formatShortDate, formatDifficultyLabel, difficultyValueMap } from "@/lib/format"
import { api } from "../../convex/_generated/api"

export function HistoryPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const session = authClient.useSession()
  const { isReady: isUserReady } = useEnsureUser()
  const canQuery = Boolean(session.data && isUserReady)
  const {
    results: history,
    status,
    loadMore,
    isLoading,
  } = usePaginatedQuery(
    api.playHistory.listForUserPaginated,
    canQuery ? {} : "skip",
    { initialNumItems: 20 }
  )
  const includeTuplets = loadSettings().includeTuplets

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
            {/* Left column - Title */}
            <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center">
              <h1
                className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground uppercase"
                style={{ letterSpacing: "0.1em" }}
              >
                History
              </h1>
              <p className="text-xs text-muted-foreground mt-2 landscape:text-left text-center">
                Sign in to view your play history.
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
              History
            </h1>
            <p className="text-xs text-muted-foreground mt-2 landscape:text-left text-center">
              Your recent practice sessions
            </p>
          </div>

          {/* Right column - Content */}
          <div className="w-full landscape:w-[480px] landscape:shrink-0 flex flex-col gap-4">
            <PanelContainer enableLines>
              <div className="p-4 flex flex-col gap-4">
                {isLoading && history.length === 0 ? (
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                    Loading history...
                  </p>
                ) : history.length ? (
                  <div className="max-h-[360px] overflow-y-auto pr-1">
                    <div className="grid gap-3">
                      {history.map((entry) => {
                        const entryTuplets = entry.tuplets ?? includeTuplets
                        const challengeData: ChallengeData = {
                          seed: entry.seed,
                          bpm: entry.tempo,
                          difficulty: difficultyValueMap[entry.difficulty] ?? 0.5,
                          tuplets: entryTuplets,
                        }
                        const encoded = encodeChallenge(challengeData)
                        return (
                          <div
                            key={entry._id}
                            className="border border-border p-3 flex items-center justify-between text-[10px] uppercase tracking-wider"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="text-foreground">{entry.score} pts</span>
                              <span className="text-muted-foreground/60">
                                {formatShortDate(entry.createdAt)} · {entry.tempo} bpm · {formatDifficultyLabel(entry.difficulty)} · {entryTuplets ? "Tuplets on" : "Tuplets off"}
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
                  </div>
                ) : (
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                    No history yet. Start playing to see your sessions here.
                  </p>
                )}
                {(status === "CanLoadMore" || status === "LoadingMore") && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => loadMore(20)}
                    disabled={status === "LoadingMore"}
                    className="text-[10px] uppercase tracking-wider"
                  >
                    {status === "LoadingMore" ? "Loading more..." : "Load more"}
                  </Button>
                )}
              </div>
            </PanelContainer>
          </div>
        </div>
      </main>
    </div>
  )
}
