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
      {/* Label text that lights up when on */}
      {label && (
        <span 
          className={cn(
            "text-xs font-medium uppercase tracking-wider transition-colors duration-200",
            checked 
              ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" 
              : "text-muted-foreground/50"
          )}
        >
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
          "relative w-10 h-14 rounded cursor-pointer overflow-hidden",
          "bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900",
          "border border-zinc-600",
          "shadow-[0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        {/* Inner recessed slot */}
        <div className="absolute inset-1.5 rounded-sm bg-gradient-to-b from-black via-zinc-950 to-zinc-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]">
          {/* Position indicator lines */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-zinc-700" />
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-emerald-500/40" />
        </div>

        {/* Toggle lever */}
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 w-5 h-8 rounded transition-all duration-150 ease-out",
            checked ? "bottom-1" : "top-1"
          )}
          style={{
            background: "linear-gradient(90deg, #52525b 0%, #a1a1aa 25%, #d4d4d8 50%, #a1a1aa 75%, #52525b 100%)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4)",
          }}
        >
          {/* Grip ridges */}
          <div className="absolute inset-x-0 top-2 bottom-2 flex flex-col justify-center gap-1">
            {[...Array(3)].map((_, i) => (
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
      </button>

      {/* LED indicator */}
      <div 
        className={cn(
          "w-2.5 h-2.5 rounded-full transition-all duration-200",
          "border border-zinc-700",
          checked 
            ? "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.7),inset_0_-1px_2px_rgba(0,0,0,0.3)]" 
            : "bg-emerald-950 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
        )}
      />
    </div>
  )
}
