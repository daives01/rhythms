import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { CalibrationScreen } from "@/components/CalibrationScreen"

const LATENCY_OFFSET_KEY = "rhythm-latency-offset"
const CALIBRATION_HISTORY_KEY = "rhythm-calibration-history"
const DEFAULT_LATENCY_OFFSET = 25
const MAX_HISTORY = 5

interface CalibrationEntry {
  offset: number
  timestamp: number
}

function loadLatencyOffset(): number {
  try {
    const stored = localStorage.getItem(LATENCY_OFFSET_KEY)
    return stored ? parseInt(stored, 10) : DEFAULT_LATENCY_OFFSET
  } catch {
    return DEFAULT_LATENCY_OFFSET
  }
}

function saveLatencyOffset(offset: number): void {
  try {
    localStorage.setItem(LATENCY_OFFSET_KEY, String(offset))
  } catch {
    // ignore
  }
}

function loadCalibrationHistory(): CalibrationEntry[] {
  try {
    const stored = localStorage.getItem(CALIBRATION_HISTORY_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is CalibrationEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.offset === "number" &&
        typeof entry.timestamp === "number"
    )
  } catch {
    return []
  }
}

function saveCalibrationHistory(history: CalibrationEntry[]): void {
  try {
    localStorage.setItem(CALIBRATION_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch {
    // ignore
  }
}

function addToHistory(offset: number, history: CalibrationEntry[]): CalibrationEntry[] {
  const filtered = history.filter((entry) => entry.offset !== offset)
  const newEntry: CalibrationEntry = { offset, timestamp: Date.now() }
  return [newEntry, ...filtered].slice(0, MAX_HISTORY)
}

export function CalibrationPage() {
  const navigate = useNavigate()
  const [currentOffset, setCurrentOffset] = useState(loadLatencyOffset)
  const [calibrationHistory, setCalibrationHistory] = useState<CalibrationEntry[]>(loadCalibrationHistory)

  useEffect(() => {
    const existingHistory = loadCalibrationHistory()
    const currentOff = loadLatencyOffset()
    if (existingHistory.length === 0 && currentOff !== DEFAULT_LATENCY_OFFSET) {
      const initialHistory = [{ offset: currentOff, timestamp: Date.now() }]
      setCalibrationHistory(initialHistory)
      saveCalibrationHistory(initialHistory)
    }
  }, [])

  const handleComplete = (offset: number) => {
    saveLatencyOffset(offset)
    setCurrentOffset(offset)
    const newHistory = addToHistory(offset, calibrationHistory)
    setCalibrationHistory(newHistory)
    saveCalibrationHistory(newHistory)
  }

  const handleSelectHistoryEntry = (offset: number) => {
    saveLatencyOffset(offset)
    setCurrentOffset(offset)
    const newHistory = addToHistory(offset, calibrationHistory)
    setCalibrationHistory(newHistory)
    saveCalibrationHistory(newHistory)
  }

  const handleCancel = () => {
    navigate(-1)
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
          calibrationHistory={calibrationHistory}
          onSelectHistoryEntry={handleSelectHistoryEntry}
        />
      </main>
    </div>
  )
}
