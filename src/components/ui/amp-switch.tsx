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
          "relative w-10 h-16 cursor-pointer overflow-hidden",
          "bg-muted",
          "border border-border",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        {/* Inner recessed slot */}
        <div className="absolute inset-1 bg-background shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]">
          {/* Position indicator lines */}
          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-0.5 bg-border" />
          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-2.5 h-0.5 bg-emerald-500/20" />
        </div>

        {/* Toggle lever */}
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 w-6 h-7 transition-all duration-150 ease-out",
            "bg-muted-foreground",
            checked ? "bottom-1" : "top-1"
          )}
          style={{
            boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          {/* Grip ridges */}
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
      </button>

      {/* LED indicator */}
      <div 
        className={cn(
          "w-2.5 h-2.5 transition-all duration-200 border border-zinc-700",
          checked 
            ? "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.7)]" 
            : "bg-emerald-950"
        )}
      />
    </div>
  )
}
