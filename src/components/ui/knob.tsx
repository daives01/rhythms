import { cn } from "@/lib/utils"
import { useRef, useCallback } from "react"

interface KnobProps {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  valueFormatter?: (value: number) => string
  className?: string
}

export function Knob({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  valueFormatter = (v) => String(v),
  className,
}: KnobProps) {
  const knobRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startValue = useRef(0)

  // Map value to rotation angle (-135 to 135 degrees)
  const percentage = (value - min) / (max - min)
  const rotation = -135 + percentage * 270

  const clampValue = useCallback(
    (v: number) => Math.min(max, Math.max(min, v)),
    [min, max]
  )

  const updateValue = useCallback(
    (clientY: number) => {
      const deltaY = startY.current - clientY
      const pixelsForFullRange = 150 // drag 150px to go from min to max
      const range = max - min
      const deltaValue = (deltaY / pixelsForFullRange) * range
      const newRawValue = startValue.current + deltaValue
      const snappedValue = Math.round(newRawValue / step) * step
      const newValue = clampValue(snappedValue)
      if (newValue !== value) {
        onValueChange(newValue)
      }
    },
    [min, max, step, value, onValueChange, clampValue]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let newValue = value
      const largeStep = step * 5

      switch (e.key) {
        case "ArrowUp":
        case "ArrowRight":
          e.preventDefault()
          newValue = clampValue(value + step)
          break
        case "ArrowDown":
        case "ArrowLeft":
          e.preventDefault()
          newValue = clampValue(value - step)
          break
        case "PageUp":
          e.preventDefault()
          newValue = clampValue(value + largeStep)
          break
        case "PageDown":
          e.preventDefault()
          newValue = clampValue(value - largeStep)
          break
        case "Home":
          e.preventDefault()
          newValue = min
          break
        case "End":
          e.preventDefault()
          newValue = max
          break
        default:
          return
      }

      if (newValue !== value) {
        onValueChange(newValue)
      }
    },
    [value, step, min, max, clampValue, onValueChange]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      startY.current = e.clientY
      startValue.current = value
      knobRef.current?.focus()

      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging.current) {
          updateValue(e.clientY)
        }
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [value, updateValue]
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isDragging.current = true
      startY.current = e.touches[0].clientY
      startValue.current = value
      knobRef.current?.focus()
    },
    [value]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isDragging.current) {
        updateValue(e.touches[0].clientY)
      }
    },
    [updateValue]
  )

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
  }, [])

  // Tick marks for the dial
  const ticks = []
  const tickCount = 11
  for (let i = 0; i < tickCount; i++) {
    const tickAngle = -135 + (i / (tickCount - 1)) * 270
    const isActive = tickAngle <= rotation
    ticks.push(
      <div
        key={i}
        className={cn(
          "absolute w-0.5 h-2 origin-bottom transition-colors duration-150",
          isActive ? "bg-primary" : "bg-muted-foreground/30"
        )}
        style={{
          left: "50%",
          bottom: "50%",
          transform: `translateX(-50%) rotate(${tickAngle}deg) translateY(-28px)`,
        }}
      />
    )
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {label && (
        <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
          {label}
        </span>
      )}

      {/* Knob container with tick marks */}
      <div className="relative w-20 h-20">
        {/* Tick marks ring */}
        <div className="absolute inset-0">{ticks}</div>

        {/* Main knob body */}
        <div
          ref={knobRef}
          tabIndex={0}
          role="slider"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueFormatter(value)}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onKeyDown={handleKeyDown}
          className={cn(
            "absolute inset-3 rounded-full cursor-grab active:cursor-grabbing",
            "bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900",
            "border border-zinc-600/50",
            "shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.3)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Knob indicator line */}
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-3 rounded-full bg-primary shadow-[0_0_8px_rgba(245,158,11,0.6)]"
          />
          {/* Inner ring detail */}
          <div className="absolute inset-2 rounded-full border border-zinc-700/50" />
        </div>
      </div>

      {/* Value display */}
      <span className="text-lg font-bold text-primary tabular-nums">
        {valueFormatter(value)}
      </span>
    </div>
  )
}
