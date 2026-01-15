// useKeyboardInput - handles keyboard input for rhythm game

import { useEffect } from "react"

export function useKeyboardInput(onHit: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key repeats
      if (e.repeat) return

      // Accept Space, Enter, or any letter key
      if (e.code === "Space" || e.code === "Enter" || e.code.startsWith("Key")) {
        e.preventDefault()
        onHit()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onHit, enabled])
}
