import { useEffect } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { RotateCcw } from "lucide-react"
import { PanelContainer } from "@/components/ui/panel-container"
import { PageBackButton } from "@/components/ui/page-back-button"
import { transportEngine } from "@/engines/TransportEngine"
import { decodeMelodyConfig } from "@/lib/random"
import type { MelodyGameScore } from "@/types"

interface MelodyGameOverLocationState {
  score?: MelodyGameScore
  expectedNoteName?: string | null
}

const EMPTY_SCORE: MelodyGameScore = {
  totalNotes: 0,
  correctNotes: 0,
  missedNotes: 0,
  wrongDetections: 0,
  averageResponseMs: 0,
  timeSurvived: 0,
  barsSurvived: 0,
  accuracy: 0,
}

export function MelodyGameOverPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const melodyParam = searchParams.get("melody")
  const config = melodyParam ? decodeMelodyConfig(melodyParam) : null
  const state = (location.state as MelodyGameOverLocationState | null) ?? null
  const score = state?.score ?? EMPTY_SCORE

  useEffect(() => {
    if (!melodyParam || !config) {
      navigate("/melody", { replace: true })
    }
  }, [config, melodyParam, navigate])

  if (!melodyParam || !config) {
    return null
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
      <PageBackButton to={`/melody?melody=${melodyParam}`} label="Back" />
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl flex flex-col gap-4 animate-fade-in-up">
          <PanelContainer>
            <div className="border-b border-border px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              melody • mic on • {config.instrument}
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <h1
                  className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground uppercase"
                  style={{ letterSpacing: "0.1em" }}
                >
                  game over
                </h1>
                <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Missed note{state?.expectedNoteName ? ` • expected ${state.expectedNoteName}` : ""}
                </p>
              </div>

              <div className="grid grid-cols-2 landscape:grid-cols-4 gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <div className="border border-border p-3">
                  <div className="text-2xl font-display text-foreground">{score.accuracy}%</div>
                  <div className="mt-1">accuracy</div>
                </div>
                <div className="border border-border p-3">
                  <div className="text-2xl font-display text-foreground">{score.correctNotes}</div>
                  <div className="mt-1">correct</div>
                </div>
                <div className="border border-border p-3">
                  <div className="text-2xl font-display text-foreground">{score.wrongDetections}</div>
                  <div className="mt-1">wrong pitch</div>
                </div>
                <div className="border border-border p-3">
                  <div className="text-2xl font-display text-foreground">{score.timeSurvived.toFixed(1)}s</div>
                  <div className="mt-1">survived</div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <span>{score.barsSurvived} bars</span>
                <span>·</span>
                <span>{score.missedNotes} miss</span>
                <span>·</span>
                <span>{score.averageResponseMs}ms avg</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    transportEngine.unlockAudio()
                    navigate(`/melody-play?melody=${melodyParam}&start=practice&mic=1`, {
                      state: { audioUnlocked: true },
                    })
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/melody?melody=${melodyParam}`)}
                  className="px-3 py-1.5 border border-border text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  Back to setup
                </button>
              </div>
            </div>
          </PanelContainer>
        </div>
      </main>
    </div>
  )
}
