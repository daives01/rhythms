import { cn } from "@/lib/utils"

interface GameButtonProps {
  label: string
  onClick: () => void
  active?: boolean
  warning?: boolean
  className?: string
}

export function GameButton({ label, onClick, active = false, warning = false, className }: GameButtonProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <span
        className={cn(
          "text-xs font-medium uppercase tracking-wider transition-colors duration-200",
          warning && "text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)] animate-blink",
          !warning && !active && "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)] animate-blink",
          !warning && active && "text-zinc-500"
        )}
      >
        {label}
      </span>

      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative w-16 h-16 cursor-pointer overflow-hidden",
          "bg-muted border border-border",
          "hover:border-foreground/30 active:scale-95",
          "transition-all duration-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        <div className="absolute inset-1 bg-background shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] flex items-center justify-center">
          <div
            className={cn(
              "w-10 h-10 transition-all duration-100 bg-muted-foreground hover:bg-muted-foreground/80",
              !warning && active && "bg-zinc-600"
            )}
            style={{
              boxShadow: "0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)"
            }}
          />
        </div>
      </button>

      <div
        className={cn(
          "w-2.5 h-2.5 transition-all duration-200 border border-zinc-700",
          warning && "bg-red-500 shadow-[0_0_8px_rgba(248,113,113,0.7)] animate-blink",
          !warning && !active && "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-blink",
          !warning && active && "bg-zinc-600"
        )}
      />
    </div>
  )
}
