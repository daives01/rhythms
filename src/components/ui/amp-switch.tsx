import { cn } from "@/lib/utils"

interface AmpSwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  className?: string
}

export function AmpSwitch({ checked, onCheckedChange, label, className }: AmpSwitchProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {label && (
        <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
          {label}
        </span>
      )}

      {/* Switch housing */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative w-10 h-16 rounded-md cursor-pointer",
          "bg-gradient-to-b from-zinc-800 via-zinc-900 to-black",
          "border border-zinc-700/50",
          "shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.05)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        {/* Toggle bat/lever */}
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 w-6 h-10 rounded transition-all duration-150",
            "bg-gradient-to-b from-zinc-400 via-zinc-500 to-zinc-600",
            "border border-zinc-500/50",
            "shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.3)]",
            checked
              ? "top-1 rounded-b-lg"
              : "bottom-1 rounded-t-lg"
          )}
        >
          {/* Grip lines on the toggle */}
          <div className="absolute inset-x-1.5 top-1/2 -translate-y-1/2 space-y-1">
            <div className="h-px bg-zinc-700/50" />
            <div className="h-px bg-zinc-700/50" />
            <div className="h-px bg-zinc-700/50" />
          </div>
        </div>

        {/* LED indicator */}
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full transition-all duration-150",
            checked
              ? "bottom-2 bg-primary shadow-[0_0_8px_rgba(245,158,11,0.8),0_0_16px_rgba(245,158,11,0.4)]"
              : "top-2 bg-zinc-700"
          )}
        />
      </button>

      {/* On/Off labels */}
      <div className="flex justify-between w-10 text-[10px] font-medium text-muted-foreground/60 uppercase">
        <span className={cn(checked && "text-primary")}>On</span>
        <span className={cn(!checked && "text-foreground/60")}>Off</span>
      </div>
    </div>
  )
}
