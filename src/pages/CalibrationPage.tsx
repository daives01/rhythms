import { useNavigate } from "react-router-dom"
import { CalibrationScreen } from "@/components/CalibrationScreen"

const LATENCY_OFFSET_KEY = "rhythm-latency-offset"

function loadLatencyOffset(): number {
  try {
    const stored = localStorage.getItem(LATENCY_OFFSET_KEY)
    return stored ? parseInt(stored, 10) : 0
  } catch {
    return 0
  }
}

function saveLatencyOffset(offset: number): void {
  try {
    localStorage.setItem(LATENCY_OFFSET_KEY, String(offset))
  } catch {
    // ignore
  }
}

export function CalibrationPage() {
  const navigate = useNavigate()
  const currentOffset = loadLatencyOffset()

  const handleComplete = (offset: number) => {
    saveLatencyOffset(offset)
    navigate("/")
  }

  const handleCancel = () => {
    navigate("/")
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
      <main className="flex-1 flex flex-col relative overflow-auto">
        <CalibrationScreen
          onComplete={handleComplete}
          onCancel={handleCancel}
          currentOffset={currentOffset}
        />
      </main>

      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div
          className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-30"
          style={{
            background: "radial-gradient(ellipse at center, rgba(245,158,11,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-1/4 right-0 w-[600px] h-[400px] opacity-20"
          style={{
            background: "radial-gradient(ellipse at center, rgba(245,158,11,0.1) 0%, transparent 70%)",
          }}
        />
      </div>
    </div>
  )
}
