import { useRef, useState, useEffect, type ReactNode } from "react"
import { TiltContext, type TiltContextValue } from "./tilt-context"
export { useTilt } from "./tilt-context"

interface PerspectivePanelProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  maxTilt?: number // Maximum tilt in degrees
  smoothing?: number // Smoothing factor (0-1, higher = smoother)
}

export function PerspectivePanel({
  children,
  className,
  style,
  maxTilt = 8,
  smoothing = 0.15,
}: PerspectivePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const targetTilt = useRef({ x: 0, y: 0 })
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = panel.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      // Calculate offset from center (-1 to 1)
      const offsetX = (e.clientX - centerX) / (rect.width / 2)
      const offsetY = (e.clientY - centerY) / (rect.height / 2)

      // Clamp to reasonable range
      const clampedX = Math.max(-1, Math.min(1, offsetX))
      const clampedY = Math.max(-1, Math.min(1, offsetY))

      // Set target tilt (inverted for natural feel)
      // Mouse right -> panel tilts left (rotates around Y axis negatively)
      // Mouse down -> panel tilts up (rotates around X axis positively)
      targetTilt.current = {
        x: -clampedY * maxTilt,
        y: clampedX * maxTilt,
      }
    }

    const handleMouseLeave = () => {
      // Smoothly return to neutral
      targetTilt.current = { x: 0, y: 0 }
    }

    // Animation loop for smooth interpolation
    const animate = () => {
      setTilt((current) => ({
        x: current.x + (targetTilt.current.x - current.x) * smoothing,
        y: current.y + (targetTilt.current.y - current.y) * smoothing,
      }))
      animationRef.current = requestAnimationFrame(animate)
    }

    panel.addEventListener("mousemove", handleMouseMove)
    panel.addEventListener("mouseleave", handleMouseLeave)
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      panel.removeEventListener("mousemove", handleMouseMove)
      panel.removeEventListener("mouseleave", handleMouseLeave)
      cancelAnimationFrame(animationRef.current)
    }
  }, [maxTilt, smoothing])

  // Convert degrees to radians for WebGPU knobs
  const tiltContextValue: TiltContextValue = {
    tiltX: (tilt.x * Math.PI) / 180,
    tiltY: (tilt.y * Math.PI) / 180,
  }

  return (
    <TiltContext.Provider value={tiltContextValue}>
      <div
        ref={panelRef}
        className={className}
        style={{
          ...style,
          perspective: "1000px",
          perspectiveOrigin: "center center",
        }}
      >
        <div
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transformStyle: "preserve-3d",
            transition: "none",
          }}
        >
          {children}
        </div>
      </div>
    </TiltContext.Provider>
  )
}
