import { cn } from "@/lib/utils"
import type { HitResult } from "@/types"
import { useRef, useEffect, useState, useCallback } from "react"

interface TouchPadProps {
  onTap: () => void
  disabled?: boolean
  lastResult?: HitResult | null
}

interface Ripple {
  id: number
  x: number
  y: number
}

export function TouchPad({ onTap, disabled = false, lastResult }: TouchPadProps) {
  const [ripples, setRipples] = useState<Ripple[]>([])
  const [isPressed, setIsPressed] = useState(false)
  const rippleId = useRef(0)
  const padRef = useRef<HTMLButtonElement>(null)
  // Track active touch IDs to handle multi-touch correctly
  const activeTouches = useRef<Set<number>>(new Set())

  const createRipple = useCallback((clientX: number, clientY: number) => {
    if (!padRef.current) return
    const rect = padRef.current.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100
    const id = rippleId.current++
    setRipples((prev) => [...prev, { id, x, y }])
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id))
    }, 600)
  }, [])

  // Handle touch events directly for faster response and multi-touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()

    // Process each new touch point as a separate tap
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]
      // Only trigger if this is a new touch
      if (!activeTouches.current.has(touch.identifier)) {
        activeTouches.current.add(touch.identifier)
        createRipple(touch.clientX, touch.clientY)
        onTap()
      }
    }
    setIsPressed(true)
  }, [disabled, onTap, createRipple])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Remove ended touches from tracking
    for (let i = 0; i < e.changedTouches.length; i++) {
      activeTouches.current.delete(e.changedTouches[i].identifier)
    }

    if (activeTouches.current.size === 0) {
      setIsPressed(false)
    }
  }, [])

  // Fallback for mouse/pointer (desktop)
  const handlePointerDown = (e: React.PointerEvent) => {
    // Skip if this is a touch event (already handled by touchstart)
    if (e.pointerType === "touch") return
    if (disabled) return
    e.preventDefault()
    setIsPressed(true)
    createRipple(e.clientX, e.clientY)
    onTap()
  }

  const handlePointerUp = useCallback((e: PointerEvent) => {
    // Skip if this is a touch event
    if (e.pointerType === "touch") return
    setIsPressed(false)
  }, [])

  // Prevent all default behaviors that could interfere
  const preventDefaults = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  useEffect(() => {
    window.addEventListener("pointerup", handlePointerUp)
    return () => window.removeEventListener("pointerup", handlePointerUp)
  }, [handlePointerUp])

  // Clear active touches on unmount
  useEffect(() => {
    return () => {
      activeTouches.current.clear()
    }
  }, [])

  const getFeedbackColor = () => {
    if (!lastResult) return null
    switch (lastResult) {
      case "hit":
        return "hit"
      case "miss":
      case "extra":
        return "miss"
      default:
        return null
    }
  }

  const feedbackColor = getFeedbackColor()
  const showMiss = feedbackColor === "miss"

  return (
    <button
      ref={padRef}
      // Touch events for mobile - fastest response
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onTouchMove={preventDefaults}
      // Pointer events for desktop
      onPointerDown={handlePointerDown}
      // Prevent context menu on long-press
      onContextMenu={preventDefaults}
      // Prevent double-tap text selection
      onDoubleClick={preventDefaults}
      disabled={disabled}
      className={cn(
        "relative w-full h-40 md:h-48 overflow-hidden",
        "rounded-[2rem] transition-all duration-75 ease-out",
        // Critical: prevent ALL touch behaviors
        "touch-none select-none cursor-pointer",
        // Prevent iOS callout and highlight
        "[&]:[-webkit-touch-callout:none] [&]:[-webkit-tap-highlight-color:transparent]",
        // Base styling - deep drum pad aesthetic
        "bg-gradient-to-b from-[#1a1816] via-[#141210] to-[#0d0b0a]",
        "border border-[#2a2725]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.03),inset_0_-8px_24px_rgba(0,0,0,0.4),0_4px_24px_-4px_rgba(0,0,0,0.5)]",
        // Pressed state - sink into the pad
        isPressed && "scale-[0.985] shadow-[inset_0_6px_20px_rgba(0,0,0,0.6)]",
        // Feedback states - dramatic glows
        feedbackColor === "hit" && "border-perfect/60 shadow-[inset_0_0_40px_rgba(132,204,22,0.15),0_0_60px_-10px_rgba(132,204,22,0.5)]",
        feedbackColor === "miss" && "border-miss/60 shadow-[inset_0_0_40px_rgba(239,68,68,0.15),0_0_60px_-10px_rgba(239,68,68,0.5)]",
        // Disabled
        disabled && "opacity-50 cursor-not-allowed"
      )}
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Concentric rings - drum pad pattern */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[0.85, 0.65, 0.45, 0.25].map((scale, i) => (
          <div
            key={i}
            className={cn(
              "absolute rounded-full border transition-all duration-100",
              isPressed
                ? "border-primary/20"
                : feedbackColor === "hit"
                ? "border-perfect/30"
                : feedbackColor === "miss"
                ? "border-miss/30"
                : "border-white/[0.04]"
            )}
            style={{
              width: `${scale * 100}%`,
              height: `${scale * 140}%`,
              transform: isPressed ? `scale(${1 - i * 0.01})` : undefined,
            }}
          />
        ))}
      </div>

      {/* Center glow zone */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-100",
          isPressed ? "opacity-100" : "opacity-0"
        )}
      >
        <div
          className="w-32 h-32 rounded-full"
          style={{
            background: feedbackColor
              ? `radial-gradient(circle, ${
                  feedbackColor === "hit"
                    ? "rgba(132,204,22,0.3)"
                    : "rgba(239,68,68,0.3)"
                } 0%, transparent 70%)`
              : "radial-gradient(circle, rgba(245,158,11,0.25) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className={cn(
            "absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none",
            "animate-ripple",
            feedbackColor === "hit"
              ? "bg-perfect/40"
              : feedbackColor === "miss"
              ? "bg-miss/40"
              : "bg-primary/30"
          )}
          style={{ left: `${ripple.x}%`, top: `${ripple.y}%` }}
        />
      ))}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
        {showMiss ? (
          <span
            key={Date.now()}
            className="text-4xl md:text-5xl font-display font-bold animate-count-pulse drop-shadow-lg text-miss"
            style={{ textShadow: "0 0 30px rgba(239,68,68,0.5)" }}
          >
            Miss
          </span>
        ) : (
          <>
            {/* Animated dots indicator */}
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-100",
                    isPressed
                      ? "bg-primary scale-150 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                      : "bg-muted-foreground/25"
                  )}
                  style={{
                    transitionDelay: isPressed ? `${i * 25}ms` : "0ms",
                  }}
                />
              ))}
            </div>
            <span
              className={cn(
                "text-xs uppercase tracking-[0.25em] font-semibold transition-colors duration-100",
                isPressed ? "text-primary" : "text-muted-foreground/60"
              )}
            >
              Tap
            </span>
          </>
        )}
      </div>

      {/* Edge highlights */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-black/30 to-transparent" />
    </button>
  )
}
