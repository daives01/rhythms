import { cn } from "@/lib/utils"

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  className?: string
}

export function Switch({ checked, onCheckedChange, label, className }: SwitchProps) {
  return (
    <label className={cn("flex items-center justify-between gap-4 cursor-pointer", className)}>
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
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer border border-border bg-muted transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          checked && "bg-emerald-950 border-emerald-800"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-3 w-3 bg-muted-foreground transition-all duration-150 mt-0.5 ml-0.5",
            checked && "translate-x-4 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
          )}
        />
      </button>
    </label>
  )
}
