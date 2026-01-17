import { useState, useEffect, useRef } from "react"
import { transportEngine } from "@/engines/TransportEngine"
import { useKeyboardInput } from "@/hooks/useKeyboardInput"
import { Button } from "@/components/ui/button"
import { TouchPad } from "./TouchPad"

interface CalibrationScreenProps {
  onComplete: (offset: number) => void
  onCancel: () => void
  currentOffset: number
}

const CALIBRATION_BPM = 90
const REQUIRED_TAPS = 16
const MAX_DEVIATION = 300

export function CalibrationScreen({ onComplete, onCancel, currentOffset }: CalibrationScreenProps) {
  const [phase, setPhase] = useState<"intro" | "countIn" | "tapping" | "done">("intro")
  const [countInBeat, setCountInBeat] = useState<number | null>(null)
  const [tapCount, setTapCount] = useState(0)
  const [offsets, setOffsets] = useState<number[]>([])
  const [calculatedOffset, setCalculatedOffset] = useState<number | null>(null)
  
  const expectedBeatTimes = useRef<number[]>([])
  const lastMatchedBeatIndex = useRef(0)
  const isListening = useRef(false)

  const handleCancel = () => {
    isListening.current = false
    transportEngine.stop()
    onCancel()
  }

  const handleTap = () => {
    if (phase !== "tapping" || !isListening.current) return

    const tapTime = transportEngine.now()
    const beats = expectedBeatTimes.current
    
    // Find the closest beat to this tap that hasn't been matched yet
    let bestIndex = -1
    let bestOffset = Infinity
    
    for (let i = lastMatchedBeatIndex.current; i < beats.length; i++) {
      const offset = (tapTime - beats[i]) * 1000
      
      // Only consider beats within deviation range
      if (Math.abs(offset) <= MAX_DEVIATION) {
        if (Math.abs(offset) < Math.abs(bestOffset)) {
          bestIndex = i
          bestOffset = offset
        }
      } else if (offset < -MAX_DEVIATION) {
        // This beat is too far in the future, stop searching
        break
      }
    }
    
    if (bestIndex !== -1) {
      setOffsets(prev => [...prev, bestOffset])
      setTapCount(prev => prev + 1)
      lastMatchedBeatIndex.current = bestIndex + 1
    }
  }

  useKeyboardInput(handleTap, phase === "tapping")

  // Allow escape to cancel during calibration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (phase === "countIn" || phase === "tapping")) {
        handleCancel()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [phase])

  const startCalibration = async () => {
    // Stop any existing transport first to prevent corruption
    transportEngine.stop()

    transportEngine.setBpm(CALIBRATION_BPM)
    setPhase("countIn")
    setCountInBeat(null)
    setTapCount(0)
    setOffsets([])
    lastMatchedBeatIndex.current = 0
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
      
      if (offsets.length > 0) {
        const sorted = [...offsets].sort((a, b) => a - b)
        const trimCount = Math.floor(sorted.length * 0.15)
        const trimmed = sorted.slice(trimCount, sorted.length - trimCount)
        const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length
        setCalculatedOffset(Math.round(avg))
      }
      
      setPhase("done")
    }
  }, [tapCount, offsets, phase])

  useEffect(() => {
    return () => {
      transportEngine.stop()
    }
  }, [])

  const handleAccept = () => {
    if (calculatedOffset !== null) {
      onComplete(calculatedOffset)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">
      {phase === "intro" && (
        <>
          <div className="text-center mb-8 animate-fade-in-up opacity-0" style={{ animationDelay: "0.1s" }}>
            <h2 className="text-3xl font-display font-bold mb-3">
              <span className="text-gradient">Calibrate</span> Latency
            </h2>
            <p className="text-muted-foreground">
              Tap along to {REQUIRED_TAPS} quarter note beats. We'll measure your average timing to compensate for audio/input latency.
            </p>
          </div>

          <div
            className="w-full bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 mb-8 animate-fade-in-up opacity-0"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-2">Current Offset</div>
              <div className="text-2xl font-bold tabular-nums">
                {currentOffset > 0 ? "+" : ""}{currentOffset} ms
              </div>
            </div>
          </div>

          <div
            className="w-full space-y-3 animate-fade-in-up opacity-0"
            style={{ animationDelay: "0.3s" }}
          >
            <Button size="xl" onClick={startCalibration} className="w-full">
              Start Calibration
            </Button>
            <Button variant="outline" size="lg" onClick={onCancel} className="w-full">
              Cancel
            </Button>
          </div>
        </>
      )}

      {phase === "countIn" && (
        <div className="flex-1 flex flex-col items-center justify-center w-full gap-8">
          <div className="text-center">
            <p className="text-muted-foreground mb-6 text-lg animate-fade-in">Get ready to tap...</p>
            <div
              key={countInBeat}
              className="text-9xl font-display font-bold text-primary animate-count-pulse"
              style={{ textShadow: "0 0 60px rgba(245,158,11,0.5)" }}
            >
              {countInBeat ?? ""}
            </div>
          </div>

          {/* TouchPad preview during count-in */}
          <div className="w-full max-w-xl px-4 animate-fade-in opacity-70">
            <TouchPad onTap={() => {}} disabled />
          </div>

          <Button variant="ghost" size="lg" onClick={handleCancel}>
            Cancel (Esc)
          </Button>
        </div>
      )}

      {phase === "tapping" && (
        <div className="w-full flex flex-col items-center gap-8 animate-fade-in">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Tap along to what you hear</p>
            <div className="text-5xl font-display font-bold text-primary tabular-nums">
              {tapCount} / {REQUIRED_TAPS}
            </div>
          </div>

          <div className="w-full max-w-xl">
            <TouchPad onTap={handleTap} />
          </div>

          <Button variant="ghost" size="lg" onClick={handleCancel}>
            Cancel (Esc)
          </Button>
        </div>
      )}

      {phase === "done" && (
        <>
          <div className="text-center mb-8 animate-fade-in-up opacity-0" style={{ animationDelay: "0.1s" }}>
            <h2 className="text-3xl font-display font-bold mb-3">
              Calibration <span className="text-primary">Complete</span>
            </h2>
          </div>

          <div
            className="w-full bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-6 mb-8 animate-fade-in-up opacity-0"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <div className="text-sm text-muted-foreground mb-2">Previous</div>
                <div className="text-2xl font-bold tabular-nums text-muted-foreground">
                  {currentOffset > 0 ? "+" : ""}{currentOffset} ms
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">New Offset</div>
                <div className="text-2xl font-bold tabular-nums text-primary">
                  {calculatedOffset !== null && (calculatedOffset > 0 ? "+" : "")}{calculatedOffset} ms
                </div>
              </div>
            </div>
          </div>

          <div
            className="w-full space-y-3 animate-fade-in-up opacity-0"
            style={{ animationDelay: "0.3s" }}
          >
            <Button size="xl" onClick={handleAccept} className="w-full">
              Apply Offset
            </Button>
            <Button variant="outline" size="lg" onClick={startCalibration} className="w-full">
              Recalibrate
            </Button>
            <Button variant="ghost" size="lg" onClick={onCancel} className="w-full">
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
