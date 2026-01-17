import { GameButton } from "@/components/ui/game-button"

interface SoundboardButtonProps {
  label: string
  onClick: () => void
  active?: boolean
  warning?: boolean
  className?: string
}

export function SoundboardButton({ label, onClick, active = false, warning = false, className }: SoundboardButtonProps) {
  return (
    <GameButton
      label={label}
      onClick={onClick}
      active={active}
      warning={warning}
      className={className}
    />
  )
}
