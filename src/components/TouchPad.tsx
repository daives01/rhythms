// TouchPad - large tappable area for rhythm input with satisfying visual feedback

import { cn } from "@/lib/utils"
import type { HitResult } from "@/types"
import { useRef, useEffect, useState } from "react"

interface TouchPadProps {
  onTap: () => void
  disabled?: boolean
  lastResult?: HitResult | null
  timingError?: number
}

interface Ripple {
  id: number
  x: number
  y: number
}

export function TouchPad({ onTap, disabled = false, lastResult, timingError = 0 }: TouchPadProps) {
  const [ripples, setRipples] = useState<Ripple[]>([])
  const [isPressed, setIsPressed] = useState(false)
  const rippleId = useRef(0)
  const padRef = useRef<HTMLButtonElement>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    setIsPressed(true)

    // Create ripple at touch/click position
    if (padRef.current) {
      const rect = padRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      const id = rippleId.current++
      setRipples((prev) => [...prev, { id, x, y }])

      // Remove ripple after animation
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id))
      }, 600)
    }

    onTap()
  }

  const handlePointerUp = () => {
    setIsPressed(false)
  }

  useEffect(() => {
    window.addEventListener("pointerup", handlePointerUp)
    return () => window.removeEventListener("pointerup", handlePointerUp)
  }, [])

  // Determine feedback styling
  const getFeedbackColor = () => {
    if (!lastResult) return null
    switch (lastResult) {
      case "hit":
        if (Math.abs(timingError) < 25) return "perfect"
        if (timingError < 0) return "early"
        return "late"
      case "miss":
      case "extra":
        return "miss"
      default:
        return null
    }
  }

  const getFeedbackText = () => {
    if (!lastResult) return null
    switch (lastResult) {
      case "hit":
        if (Math.abs(timingError) < 25) return "Perfect"
        if (timingError < 0) return "Early"
        return "Late"
      case "miss":
        return "Miss"
      case "extra":
        return "Extra"
      default:
        return null
    }
  }

  const feedbackColor = getFeedbackColor()
  const feedbackText = getFeedbackText()

  return (
    <button
      ref={padRef}
      onPointerDown={handlePointerDown}
      disabled={disabled}
      className={cn(
        "relative w-full h-36 md:h-44 overflow-hidden",
        "rounded-3xl transition-all duration-100 ease-out",
        "touch-none select-none cursor-pointer",
        // Base styling - looks like a drum pad
        "bg-gradient-to-b from-muted to-card",
        "border-2 border-border",
        "shadow-[inset_0_2px_4px_rgba(255,255,255,0.05),inset_0_-4px_8px_rgba(0,0,0,0.3)]",
        // Pressed state
        isPressed && "scale-[0.98] shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)]",
        // Feedback states
        feedbackColor === "perfect" && "border-perfect shadow-[0_0_40px_-10px_rgba(132,204,22,0.6)]",
        feedbackColor === "early" && "border-early shadow-[0_0_40px_-10px_rgba(250,204,21,0.6)]",
        feedbackColor === "late" && "border-late shadow-[0_0_40px_-10px_rgba(251,146,60,0.6)]",
        feedbackColor === "miss" && "border-miss shadow-[0_0_40px_-10px_rgba(239,68,68,0.6)]",
        // Disabled
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Inner glow effect */}
      <div
        className={cn(
          "absolute inset-4 rounded-2xl transition-opacity duration-200",
          "bg-gradient-to-b from-white/5 to-transparent",
          isPressed ? "opacity-0" : "opacity-100"
        )}
      />

      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className={cn(
            "absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full",
            "bg-primary/30 animate-ripple pointer-events-none"
          )}
          style={{ left: `${ripple.x}%`, top: `${ripple.y}%` }}
        />
      ))}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        {feedbackText ? (
          <span
            key={feedbackText}
            className={cn(
              "text-3xl md:text-4xl font-display font-bold animate-count-pulse",
              feedbackColor === "perfect" && "text-perfect",
              feedbackColor === "early" && "text-early",
              feedbackColor === "late" && "text-late",
              feedbackColor === "miss" && "text-miss"
            )}
          >
            {feedbackText}
          </span>
        ) : (
          <>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full bg-muted-foreground/30 transition-all",
                    isPressed && "bg-primary scale-125"
                  )}
                  style={{ transitionDelay: `${i * 30}ms` }}
                />
              ))}
            </div>
            <span className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Tap
            </span>
          </>
        )}
      </div>

      {/* Bottom highlight */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </button>
  )
}
