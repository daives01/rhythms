import { useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface SliderPrimitiveProps {
  value: number
  onValueChange: (value: number) => void
  color?: string
  label?: React.ReactNode
  units?: string[]
  min?: number
  max?: number
  step?: number
  snapPoints?: number[]
}

export function SliderPrimitive({
  value,
  onValueChange,
  color,
  label,
  units,
  min = 0,
  max = 100,
  step = 1,
  snapPoints,
}: SliderPrimitiveProps) {
  const percentage = ((value - min) / (max - min)) * 100
  const isActive = value > 0
  const ledColor = color || "rgb(52, 211, 153)"
  
  const inputRef = useRef<HTMLInputElement>(null)
  const isSnappping = useRef(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const handleChange = (newValue: number) => {
    if (!isSnappping.current) {
      console.log('onChange:', newValue)
      onValueChange(newValue)
    } else {
      console.log('onChange skipped (snapping)')
    }
  }

  const handleRelease = () => {
    console.log('handleRelease called')
    if (!inputRef.current || !snapPoints || snapPoints.length === 0) {
      console.log('skipping snap - no ref or snapPoints')
      return
    }
    
    const currentValue = Number(inputRef.current.value)
    console.log('currentValue:', currentValue)
    console.log('snapPoints:', snapPoints)
    
    const nearest = snapPoints.reduce((prev, curr) => 
      Math.abs(curr - currentValue) < Math.abs(prev - currentValue) ? curr : prev
    )
    console.log('nearest snap point:', nearest)
    
    setIsAnimating(true)
    isSnappping.current = true
    onValueChange(nearest)
    
    setTimeout(() => {
      isSnappping.current = false
      setIsAnimating(false)
    }, 300)
  }
  const ledRgba = `rgba(${ledColor.match(/\d+/g)?.slice(0, 3).join(", ") || "52, 211, 153"}, 0.7)`
  const textShadow = `0 0 6px rgba(${ledColor.match(/\d+/g)?.slice(0, 3).join(", ") || "52, 211, 153"}, 0.5)`

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 relative">
        <div className="flex items-center gap-3 w-16 shrink-0 relative z-10">
          <div 
            className="w-2.5 h-2.5 transition-all duration-200 border border-zinc-700 shrink-0"
            style={{ 
              backgroundColor: ledColor,
              boxShadow: ledRgba
            }}
          />

          {label && (
            <span
              className="text-xs font-medium uppercase tracking-wider truncate"
              style={{ 
                color: ledColor,
                textShadow
              }}
            >
              {label}
            </span>
          )}
        </div>

        <div className="relative flex-1 flex flex-col">
          <div className="relative h-8 flex items-center">
            <div className="relative w-full h-4 bg-muted border border-border rounded-sm">
              <div className="absolute inset-x-1 inset-y-1 bg-background rounded-[2px]" />
              
              <div 
                className={cn(
                  "absolute top-1/2 w-4 h-4 pointer-events-none",
                  isActive && "shadow-[0_0_6px_rgba(52,211,153,0.25)]",
                  isAnimating && "transition-all duration-300 ease-out"
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
                />
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
              className={cn(
                "absolute inset-0 w-full h-full appearance-none cursor-ew-resize bg-transparent z-10",
                "[&::-webkit-slider-thumb]:appearance-none",
                "[&::-webkit-slider-thumb]:w-4",
                "[&::-webkit-slider-thumb]:h-4",
                "[&::-webkit-slider-thumb]:bg-transparent",
                "[&::-webkit-slider-thumb]:cursor-ew-resize",
                "[&::-moz-range-thumb]:w-4",
                "[&::-moz-range-thumb]:h-4",
                "[&::-moz-range-thumb]:bg-transparent",
                "[&::-moz-range-thumb]:border-none",
                "[&::-moz-range-thumb]:cursor-ew-resize",
                "[&::-webkit-slider-runnable-track]:bg-transparent",
              "[&::-moz-range-track]:bg-transparent"
            )}
          />
          </div>

          {units && units.length === 3 && (
            <div className="relative h-5 w-full">
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
