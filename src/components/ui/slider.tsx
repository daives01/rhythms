import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface SliderProps {
  value: number
  onValueChange: (value: number) => void
  color?: string
  icon?: LucideIcon
  label?: string
  units?: string[]
  min?: number
  max?: number
  step?: number
  snapPoints?: number[]
  disabled?: boolean
  animate?: boolean
}

export function Slider({
  value,
  onValueChange,
  color,
  icon: Icon,
  label,
  units,
  min = 0,
  max = 100,
  step = 1,
  snapPoints,
  disabled = false,
  animate = false,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100
  const isActive = value > 0
  const baseLedColor = color || "rgb(52, 211, 153)"
  const ledColor = disabled ? "rgb(63, 63, 70)" : baseLedColor

  const inputRef = useRef<HTMLInputElement>(null)
  const isSnapping = useRef(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleChange = (newValue: number) => {
    if (!isSnapping.current && !disabled) {
      onValueChange(newValue)
    }
  }

  const handleRelease = () => {
    if (!inputRef.current || !snapPoints || snapPoints.length === 0) {
      return
    }

    const currentValue = Number(inputRef.current.value)
    const nearest = snapPoints.reduce((prev, curr) =>
      Math.abs(curr - currentValue) < Math.abs(prev - currentValue) ? curr : prev
    )

    setIsAnimating(true)
    isSnapping.current = true
    onValueChange(nearest)

    setTimeout(() => {
      isSnapping.current = false
      setIsAnimating(false)
    }, 300)
  }
  const ledRgba = `rgba(${ledColor.match(/\d+/g)?.slice(0, 3).join(", ") || "52, 211, 153"}, 0.7)`
  const textShadow = `0 0 6px rgba(${ledColor.match(/\d+/g)?.slice(0, 3).join(", ") || "52, 211, 153"}, 0.5)`

  return (
    <div className="flex flex-col gap-1 relative">
      {Icon && (
        <div
          className="absolute -left-10 top-0 h-12 w-10 flex items-center justify-center z-10"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Icon
            className="w-5 h-5"
            style={{
              color: ledColor,
              filter: `drop-shadow(0 0 4px ${ledRgba})`
            }}
          />
          {label && isHovered && (
            <div
              className="absolute left-full ml-2 px-2 py-1 rounded text-xs font-medium uppercase tracking-wider whitespace-nowrap z-20"
              style={{
                color: ledColor,
                backgroundColor: "rgb(24, 24, 27)",
                border: "1px solid rgb(39, 39, 42)",
                textShadow
              }}
            >
              {label}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center relative pl-4">
        <div className="relative flex-1 flex flex-col">
          <div className="relative h-12 flex items-center">
            <div className="relative w-full h-4 bg-muted border border-border rounded-sm">
              <div className="absolute inset-x-1 inset-y-1 bg-background rounded-[2px]" />

              <div
                className={cn(
                  "absolute top-1/2 w-4 h-4 pointer-events-none",
                  isActive && "shadow-[0_0_6px_rgba(52,211,153,0.25)]",
                  (isAnimating || animate) && "transition-all duration-300 ease-out"
                )}
                style={{
                  left: `${percentage}%`,
                  transform: "translate(-50%, -50%)"
                }}
              >
                <div
                  className="absolute inset-0 rounded-sm bg-muted-foreground"
                  style={{
                    boxShadow: "0 1px 2px rgba(0,0,0,0.5)"
                  }}
                >
                  <div className="absolute inset-x-0 top-1 bottom-1 flex flex-col justify-center gap-0.5">
                    {[...Array(2)].map((_, i) => (
                      <div
                        key={i}
                        className="h-px mx-1"
                        style={{
                          background: "linear-gradient(90deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.1) 100%)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <input
              ref={inputRef}
              type="range"
              value={value}
              onChange={(e) => handleChange(Number(e.target.value))}
              onMouseUp={handleRelease}
              onTouchEnd={handleRelease}
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              className={cn(
                "absolute inset-0 w-full h-full appearance-none bg-transparent z-10",
                disabled ? "cursor-not-allowed" : "cursor-ew-resize",
                "[&::-webkit-slider-thumb]:appearance-none",
                "[&::-webkit-slider-thumb]:w-12",
                "[&::-webkit-slider-thumb]:h-12",
                "[&::-webkit-slider-thumb]:bg-transparent",
                disabled ? "[&::-webkit-slider-thumb]:cursor-not-allowed" : "[&::-webkit-slider-thumb]:cursor-ew-resize",
                "[&::-webkit-slider-thumb]:shadow-none",
                "[&::-webkit-slider-thumb]:border-none",
                "[&::-moz-range-thumb]:w-12",
                "[&::-moz-range-thumb]:h-12",
                "[&::-moz-range-thumb]:bg-transparent",
                "[&::-moz-range-thumb]:border-none",
                "[&::-moz-range-thumb]:shadow-none",
                disabled ? "[&::-moz-range-thumb]:cursor-not-allowed" : "[&::-moz-range-thumb]:cursor-ew-resize",
                "[&::-webkit-slider-runnable-track]:bg-transparent",
                "[&::-moz-range-track]:bg-transparent"
              )}
            />
          </div>

          {units && units.length === 3 && (
            <div className="relative h-5">
              {Array.from({ length: 17 }).map((_, index) => {
                const position = index / 16
                const isLong = index % 8 === 0
                const isMedium = index % 4 === 0 && !isLong

                const height = isLong ? "h-3" : isMedium ? "h-2" : "h-1"
                const isLit = (value - min) / (max - min) >= position

                const unitIndex = isLong ? (index === 0 ? 0 : index === 8 ? 1 : 2) : -1

                return (
                  <div
                    key={index}
                    className="absolute top-0 flex flex-col items-center"
                    style={{ left: `${position * 100}%`, transform: "translateX(-50%)" }}
                  >
                    <div
                      className={`w-px ${height} transition-colors duration-200`}
                      style={{
                        backgroundColor: isLit ? ledColor : "rgb(63, 63, 70)",
                      }}
                    />
                    {isLong && unitIndex >= 0 && (
                      <span className="text-[10px] text-zinc-400 font-medium mt-0.5">
                        {units[unitIndex]}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
