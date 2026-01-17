import { cn } from "@/lib/utils"
import type { HitResult } from "@/types"
import { useRef, useEffect, useState, useCallback } from "react"

interface TouchPadProps {
  onTap: () => void
  disabled?: boolean
  lastResult?: HitResult | null
}

export function TouchPad({ onTap, disabled = false, lastResult }: TouchPadProps) {
  const [isPressed, setIsPressed] = useState(false)
  const padRef = useRef<HTMLButtonElement>(null)
  const activePointers = useRef<Set<number>>(new Set())

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()

    if (!activePointers.current.has(e.pointerId)) {
      activePointers.current.add(e.pointerId)
      onTap()
    }
    setIsPressed(true)
  }, [disabled, onTap])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size === 0) {
      setIsPressed(false)
    }
  }, [])

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size === 0) {
      setIsPressed(false)
    }
  }, [])

  const preventDefaults = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  useEffect(() => {
    const pointers = activePointers.current
    return () => {
      pointers.clear()
    }
  }, [])

  const feedbackColor = !lastResult ? null : 
    lastResult === "hit" ? "hit" : "miss"
  const showMiss = feedbackColor === "miss"

  return (
    <button
      ref={padRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={preventDefaults}
      onDoubleClick={preventDefaults}
      disabled={disabled}
      className={cn(
        "relative w-full h-28 landscape:h-20 md:h-40 overflow-hidden",
        "rounded-2xl transition-all duration-75",
        "touch-none select-none cursor-pointer",
        "bg-gradient-to-b from-zinc-800 to-zinc-900",
        "border border-zinc-700",
        isPressed && "scale-[0.98] bg-zinc-800",
        feedbackColor === "hit" && "border-perfect/50",
        feedbackColor === "miss" && "border-miss/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {showMiss ? (
          <span className="text-3xl font-bold text-miss">Miss</span>
        ) : (
          <span className={cn(
            "text-sm uppercase tracking-widest font-medium",
            isPressed ? "text-primary" : "text-muted-foreground/50"
          )}>
            Tap
          </span>
        )}
      </div>
    </button>
  )
}
