import { cn } from "@/lib/utils"
import type { InputHTMLAttributes } from "react"

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  value: number
  onValueChange: (value: number) => void
  label?: string
  showValue?: boolean
  valueFormatter?: (value: number) => string
}

export function Slider({
  value,
  onValueChange,
  label,
  showValue = true,
  valueFormatter = (v) => String(v),
  className,
  min = 0,
  max = 100,
  step = 1,
  ...props
}: SliderProps) {
  const percentage = ((value - Number(min)) / (Number(max) - Number(min))) * 100

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-baseline">
          {label && (
            <span className="text-sm font-medium text-foreground-muted uppercase tracking-wider">
              {label}
            </span>
          )}
          {showValue && (
            <span className="text-lg font-semibold text-primary tabular-nums">
              {valueFormatter(value)}
            </span>
          )}
        </div>
      )}
      <div className="relative h-2 w-full">
        {/* Track background */}
        <div className="absolute inset-0 rounded-full bg-muted" />
        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary-deep via-primary to-primary-glow"
          style={{ width: `${percentage}%` }}
        />
        {/* Input */}
        <input
          type="range"
          value={value}
          onChange={(e) => onValueChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className={cn(
            "absolute inset-0 w-full h-full appearance-none cursor-pointer bg-transparent",
            // Webkit thumb
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:w-5",
            "[&::-webkit-slider-thumb]:h-5",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-foreground",
            "[&::-webkit-slider-thumb]:border-2",
            "[&::-webkit-slider-thumb]:border-primary",
            "[&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(245,158,11,0.5)]",
            "[&::-webkit-slider-thumb]:cursor-pointer",
            "[&::-webkit-slider-thumb]:transition-all",
            "[&::-webkit-slider-thumb]:duration-150",
            "[&::-webkit-slider-thumb]:hover:scale-110",
            "[&::-webkit-slider-thumb]:hover:shadow-[0_0_20px_rgba(245,158,11,0.7)]",
            "[&::-webkit-slider-thumb]:active:scale-95",
            // Firefox thumb
            "[&::-moz-range-thumb]:w-5",
            "[&::-moz-range-thumb]:h-5",
            "[&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:bg-foreground",
            "[&::-moz-range-thumb]:border-2",
            "[&::-moz-range-thumb]:border-primary",
            "[&::-moz-range-thumb]:cursor-pointer",
            // Track (needs to be transparent since we handle it separately)
            "[&::-webkit-slider-runnable-track]:bg-transparent",
            "[&::-moz-range-track]:bg-transparent"
          )}
          {...props}
        />
      </div>
    </div>
  )
}
