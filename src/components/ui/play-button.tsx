import { GameButton } from "@/components/ui/game-button"

interface PlayButtonProps {
  onClick: () => void
  className?: string
}

export function PlayButton({ onClick, className }: PlayButtonProps) {
  return <GameButton label="Play" onClick={onClick} variant="green" className={className} />
}
