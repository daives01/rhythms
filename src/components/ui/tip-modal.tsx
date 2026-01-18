import { Button } from "./button"

interface TipModalProps {
  title: string
  message: string
  onDismiss: (dontShowAgain: boolean) => void
}

export function TipModal({ title, message, onDismiss }: TipModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4">
      <div className="bg-muted border border-border p-5 max-w-xs w-full animate-fade-in">
        <h3 className="text-sm font-semibold text-foreground mb-2">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground mb-5">
          {message}
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => onDismiss(false)} className="w-full">
            Got it
          </Button>
          <button
            onClick={() => onDismiss(true)}
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors py-2"
          >
            Don't show again
          </button>
        </div>
      </div>
    </div>
  )
}
