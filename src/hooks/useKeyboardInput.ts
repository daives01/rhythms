import { useEffect, useRef } from "react"

// Valid keys for rhythm input - basically anything comfortable for two-handed play
const VALID_KEY_PREFIXES = ["Key", "Digit", "Numpad", "Arrow"]
const VALID_EXACT_KEYS = new Set([
  "Space",
  "Enter",
  "NumpadEnter",
  // Punctuation keys that are easy to hit
  "Semicolon",
  "Quote",
  "Comma",
  "Period",
  "Slash",
  "Backslash",
  "BracketLeft",
  "BracketRight",
  "Minus",
  "Equal",
  "Backquote",
])

function isValidKey(code: string): boolean {
  if (VALID_EXACT_KEYS.has(code)) return true
  return VALID_KEY_PREFIXES.some((prefix) => code.startsWith(prefix))
}

export function useKeyboardInput(onHit: () => void, enabled: boolean = true) {
  // Track which keys are currently held down to prevent repeat triggers
  const heldKeys = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) {
      // Clear held keys when disabled to reset state
      heldKeys.current.clear()
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key repeats (browser's built-in repeat) and our own tracking
      if (e.repeat) return
      if (heldKeys.current.has(e.code)) return

      if (isValidKey(e.code)) {
        e.preventDefault()
        heldKeys.current.add(e.code)
        onHit()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeys.current.delete(e.code)
    }

    // Clear all held keys on window blur (e.g., user switches tabs)
    const handleBlur = () => {
      heldKeys.current.clear()
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("blur", handleBlur)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("blur", handleBlur)
      heldKeys.current.clear()
    }
  }, [onHit, enabled])
}
