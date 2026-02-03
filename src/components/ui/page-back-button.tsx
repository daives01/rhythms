import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PageBackButtonProps {
  to: string | number
  label?: string
  className?: string
}

export function PageBackButton({ to, label = "Back", className }: PageBackButtonProps) {
  const navigate = useNavigate()

  return (
    <Button
      variant="ghost"
      onClick={() => navigate(to)}
      className={cn(
        "fixed left-4 top-4 z-50 text-[10px] uppercase tracking-wider",
        className
      )}
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </Button>
  )
}
