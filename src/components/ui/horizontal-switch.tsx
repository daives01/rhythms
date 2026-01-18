import { cn } from "@/lib/utils"

interface HorizontalSwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  className?: string
}

export function HorizontalSwitch({ checked, onCheckedChange, label, className }: HorizontalSwitchProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className="relative w-12 h-6 bg-muted border border-border overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="absolute inset-0.5 bg-background shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]">
          <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-2.5 bg-border" />
          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-2.5 bg-emerald-500/20" />
        </div>
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-5 h-4 bg-muted-foreground transition-all duration-150 ease-out",
            checked ? "right-0.5" : "left-0.5"
          )}
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
        >
          <div className="absolute inset-y-0 left-1 right-1 flex flex-col justify-center gap-0.5">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="h-px"
                style={{
                  background: "linear-gradient(90deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.1) 100%)",
                }}
              />
            ))}
          </div>
        </div>
      </button>
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
    </div>
  )
}
