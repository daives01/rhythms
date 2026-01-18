import { useState, useEffect, useRef } from "react"
import { transportEngine } from "@/engines/TransportEngine"
import { useKeyboardInput } from "@/hooks/useKeyboardInput"
import { Button } from "@/components/ui/button"
import { PanelContainer } from "@/components/ui/panel-container"
import { cn } from "@/lib/utils"

interface CalibrationEntry {
  offset: number
  timestamp: number
}

interface CalibrationScreenProps {
  onComplete: (offset: number) => void
  onCancel: () => void
  currentOffset: number
  calibrationHistory: CalibrationEntry[]
  onSelectHistoryEntry: (offset: number) => void
}

const CALIBRATION_BPM = 100
const REQUIRED_TAPS = 16
const MAX_HISTORY = 5

function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return "yesterday"
  return `${days}d ago`
}

export function CalibrationScreen({
  onComplete,
  onCancel,
  currentOffset,
  calibrationHistory,
  onSelectHistoryEntry,
}: CalibrationScreenProps) {
  const [phase, setPhase] = useState<"intro" | "countIn" | "tapping">("intro")
  const [countInBeat, setCountInBeat] = useState<number | null>(null)
  const [tapCount, setTapCount] = useState(0)
  const [offsets, setOffsets] = useState<number[]>([])
  const [justCalibrated, setJustCalibrated] = useState<number | null>(null)

  const expectedBeatTimes = useRef<number[]>([])
  const usedBeatIndices = useRef<Set<number>>(new Set())
  const isListening = useRef(false)

  const handleCancelCalibration = () => {
    isListening.current = false
    transportEngine.stop()
    setPhase("intro")
  }

  const handleTap = () => {
    if (phase !== "tapping" || !isListening.current) return

    const tapTime = transportEngine.now()
    const beats = expectedBeatTimes.current
    const secPerBeat = 60 / CALIBRATION_BPM
    const maxDeviation = secPerBeat * 0.49

    let bestIndex = -1
    let bestOffset = Infinity

    for (let i = 0; i < beats.length; i++) {
      if (usedBeatIndices.current.has(i)) continue

      const offsetSec = tapTime - beats[i]

      if (Math.abs(offsetSec) <= maxDeviation) {
        if (Math.abs(offsetSec) < Math.abs(bestOffset)) {
          bestIndex = i
          bestOffset = offsetSec
        }
      }
    }

    if (bestIndex !== -1) {
      usedBeatIndices.current.add(bestIndex)
      setOffsets((prev) => [...prev, bestOffset * 1000])
      setTapCount((prev) => prev + 1)
    }
  }

  useKeyboardInput(handleTap, phase === "tapping")

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (phase === "countIn" || phase === "tapping")) {
        handleCancelCalibration()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [phase])

  const startCalibration = async () => {
    transportEngine.stop()
    transportEngine.setBpm(CALIBRATION_BPM)
    setPhase("countIn")
    setCountInBeat(null)
    setTapCount(0)
    setOffsets([])
    setJustCalibrated(null)
    usedBeatIndices.current = new Set()
    expectedBeatTimes.current = []
    isListening.current = true

    await transportEngine.start()
  }

  useEffect(() => {
    if (phase !== "countIn" && phase !== "tapping") return

    const unsubBeat = transportEngine.onBeat((beat, bar, isCountIn) => {
      if (!isListening.current) return

      if (isCountIn) {
        setCountInBeat(beat + 1)
      } else {
        setCountInBeat(null)
        setPhase("tapping")

        const beatTime = transportEngine.positionToTime(bar, beat)
        expectedBeatTimes.current.push(beatTime)
      }
    })

    return () => {
      unsubBeat()
    }
  }, [phase])

  useEffect(() => {
    if (tapCount >= REQUIRED_TAPS && phase === "tapping") {
      isListening.current = false
      transportEngine.stop()

      let newOffset: number | null = null
      if (offsets.length > 0) {
        const sorted = [...offsets].sort((a, b) => a - b)
        const trimCount = Math.floor(sorted.length * 0.15)
        const trimmed = sorted.slice(trimCount, sorted.length - trimCount)
        const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length
        newOffset = Math.round(avg)
      }

      if (newOffset !== null) {
        onComplete(newOffset)
        setJustCalibrated(newOffset)
      }

      requestAnimationFrame(() => {
        setPhase("intro")
      })
    }
  }, [tapCount, offsets, phase, onComplete])

  useEffect(() => {
    return () => {
      transportEngine.stop()
    }
  }, [])

  const otherHistory = calibrationHistory
    .filter((entry) => entry.offset !== currentOffset)
    .slice(0, MAX_HISTORY - 1)

  return (
    <div className="flex-1 flex flex-col items-center justify-start landscape:justify-center overflow-y-auto p-4 landscape:px-8 landscape:py-3 pt-safe pb-safe max-w-lg landscape:max-w-5xl mx-auto w-full">
      {phase === "intro" && (
        <div className="flex-1 flex flex-col landscape:flex-row items-center justify-center gap-6 landscape:gap-12 w-full">
          {/* Left: Title */}
          <div className="flex flex-col items-center landscape:items-start landscape:flex-1 landscape:justify-center">
            <h2
              className="text-3xl landscape:text-4xl font-display font-bold tracking-tight text-foreground animate-fade-in-up uppercase"
              style={{ letterSpacing: "0.1em" }}
            >
              calibrate
            </h2>
            <p className="text-muted-foreground/60 text-xs mt-1 animate-fade-in-up">
              Measure your device's audio latency
            </p>
          </div>

          {/* Right: Panel */}
          <PanelContainer className="w-full landscape:w-[400px] landscape:shrink-0 animate-fade-in-up">
            {/* Current offset */}
            <div className="p-6 text-center">
              <div
                className={cn(
                  "text-4xl font-display font-bold tabular-nums transition-colors",
                  justCalibrated !== null ? "text-emerald-400" : "text-foreground"
                )}
              >
                {currentOffset > 0 ? "+" : ""}
                {currentOffset} ms
              </div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mt-1">
                {justCalibrated !== null ? "New Offset Applied" : "Current Offset"}
              </div>
            </div>

            {/* History */}
            {otherHistory.length > 0 && (
              <>
                <div className="h-px bg-border w-full" />
                <div className="p-3">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-2 px-1">
                    Previous Calibrations
                  </div>
                  <div className="flex flex-col gap-1">
                    {otherHistory.map((entry) => (
                      <button
                        key={`${entry.offset}-${entry.timestamp}`}
                        onClick={() => onSelectHistoryEntry(entry.offset)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-md transition-colors",
                          "hover:bg-muted/50 active:bg-muted text-left group"
                        )}
                      >
                        <span className="font-display font-bold tabular-nums text-muted-foreground group-hover:text-foreground transition-colors">
                          {entry.offset > 0 ? "+" : ""}
                          {entry.offset} ms
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          {formatTimeAgo(entry.timestamp)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="h-px bg-border w-full" />

            {/* Instructions */}
            <div className="p-4 text-center text-xs text-muted-foreground/60">
              Tap along to {REQUIRED_TAPS} beats to measure timing
            </div>

            <div className="h-px bg-border w-full" />

            {/* Actions */}
            <div className="p-6 flex flex-col gap-2">
              <Button size="lg" onClick={startCalibration} className="w-full">
                {justCalibrated !== null ? "Recalibrate" : "Start Calibration"}
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancel} className="w-full">
                Done
              </Button>
            </div>
          </PanelContainer>
        </div>
      )}

      {(phase === "countIn" || phase === "tapping") && (
        <div
          className={cn(
            "flex-1 w-full flex flex-col items-center justify-center gap-3 animate-fade-in cursor-pointer select-none"
          )}
          onPointerDown={
            phase === "tapping"
              ? (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleTap()
                }
              : undefined
          }
          style={{
            touchAction: "none",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {phase === "countIn" ? (
            <>
              <p className="text-muted-foreground text-sm animate-fade-in">Get ready to tap...</p>
              <div className="relative flex items-center justify-center">
                {countInBeat && (
                  <>
                    <div
                      key={`ring1-${countInBeat}`}
                      className="absolute w-32 landscape:w-24 h-32 landscape:h-24 rounded-full border-primary animate-count-ring"
                    />
                    <div
                      key={`ring2-${countInBeat}`}
                      className="absolute w-32 landscape:w-24 h-32 landscape:h-24 rounded-full border-primary/60 animate-count-ring"
                      style={{ animationDelay: "0.1s" }}
                    />
                  </>
                )}
                <div
                  key={countInBeat}
                  className="text-7xl landscape:text-5xl font-display font-bold text-primary animate-count-pulse leading-none"
                >
                  {countInBeat ?? ""}
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground/60 text-xs">Tap anywhere to the beat</p>
              <div className="text-5xl landscape:text-4xl font-display font-bold text-foreground tabular-nums">
                {tapCount} / {REQUIRED_TAPS}
              </div>
            </>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCancelCalibration()
            }}
            className="mt-4 py-1 px-4 text-sm font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
