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
    </div>
  )
}
