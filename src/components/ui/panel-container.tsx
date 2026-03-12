import { useRef, useState, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

interface PanelContainerProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  enableLines?: boolean
}

const GRID_OFFSET = 8

export function PanelContainer({ children, className, style, enableLines = true }: PanelContainerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState<{ top: number; bottom: number; left: number; right: number } | null>(null)

  useLayoutEffect(() => {
    if (!enableLines) return

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
    const root = document.documentElement
    const rootObserver = new ResizeObserver(updateBounds)
    rootObserver.observe(root)

    return () => {
      window.removeEventListener("resize", updateBounds)
      ro.disconnect()
      rootObserver.disconnect()
    }
  }, [enableLines])

  return (
    <div ref={ref} className={cn("relative", className)} style={style}>
      {enableLines && bounds && createPortal(
        <>
          <div className="fixed left-0 right-0 h-px bg-border pointer-events-none z-40" style={{ top: bounds.top }} />
          <div className="fixed left-0 right-0 h-px bg-border pointer-events-none z-40" style={{ top: bounds.bottom }} />
          <div className="fixed top-0 bottom-0 w-px bg-border pointer-events-none z-40" style={{ left: bounds.left }} />
          <div className="fixed top-0 bottom-0 w-px bg-border pointer-events-none z-40" style={{ left: bounds.right }} />
        </>,
        document.body
      )}
      <div className="relative bg-muted border border-border">
        {children}
      </div>
    </div>
  )
}
