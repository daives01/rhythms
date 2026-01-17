import { useRef, useState, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

interface PanelContainerProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

const GRID_OFFSET = 8

export function PanelContainer({ children, className, style }: PanelContainerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState<{ top: number; bottom: number; left: number; right: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const updateBounds = () => {
      const rect = el.getBoundingClientRect()
      setBounds({
        top: rect.top - GRID_OFFSET,
        bottom: rect.bottom + GRID_OFFSET,
        left: rect.left - GRID_OFFSET,
        right: rect.right + GRID_OFFSET,
      })
    }

    updateBounds()
    window.addEventListener("resize", updateBounds)
    const ro = new ResizeObserver(updateBounds)
    ro.observe(el)

    return () => {
      window.removeEventListener("resize", updateBounds)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={ref} className={cn("relative", className)} style={style}>
      {bounds && createPortal(
        <>
          <div className="fixed left-0 right-0 h-px bg-border pointer-events-none" style={{ top: bounds.top }} />
          <div className="fixed left-0 right-0 h-px bg-border pointer-events-none" style={{ top: bounds.bottom }} />
          <div className="fixed top-0 bottom-0 w-px bg-border pointer-events-none" style={{ left: bounds.left }} />
          <div className="fixed top-0 bottom-0 w-px bg-border pointer-events-none" style={{ left: bounds.right }} />
        </>,
        document.body
      )}
      <div className="relative bg-muted border border-border">
        {children}
      </div>
    </div>
  )
}
