import { createContext, useContext } from "react"

export interface TiltContextValue {
  tiltX: number
  tiltY: number
}

export const TiltContext = createContext<TiltContextValue>({ tiltX: 0, tiltY: 0 })

export function useTilt() {
  return useContext(TiltContext)
}
