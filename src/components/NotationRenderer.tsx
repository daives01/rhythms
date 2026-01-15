// NotationRenderer - renders 4 bars of rhythm using VexFlow with musical styling

import { useEffect, useRef, useState } from "react"
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam } from "vexflow"
import type { RuntimeBar } from "@/types"
import { cn } from "@/lib/utils"

interface NotationRendererProps {
  bars: RuntimeBar[]
  currentBar: number
  currentBeat: number
  beatFraction: number
}

// Convert bar onsets to VexFlow notes
function barToVexNotes(bar: RuntimeBar): { notes: StaveNote[]; beams: Beam[] } {
  const slots: boolean[] = new Array(16).fill(false)

  for (const onset of bar.onsets) {
    const slotIndex = onset.beatIndex * 4 + onset.n
    slots[slotIndex] = true
  }

  const notes: StaveNote[] = []
  const beamGroups: StaveNote[][] = [[], [], [], []]

  let i = 0
  while (i < 16) {
    const beatIndex = Math.floor(i / 4)

    if (slots[i]) {
      const note = new StaveNote({
        keys: ["b/4"],
        duration: "16",
        stemDirection: 1,
      })
      notes.push(note)
      beamGroups[beatIndex].push(note)
      i++
    } else {
      let restLength = 1
      while (i + restLength < 16 && !slots[i + restLength] && Math.floor((i + restLength) / 4) === beatIndex) {
        restLength++
      }

      let restDuration: string
      if (restLength >= 4 && i % 4 === 0) {
        restDuration = "qr"
        restLength = 4
      } else if (restLength >= 2 && i % 2 === 0) {
        restDuration = "8r"
        restLength = 2
      } else {
        restDuration = "16r"
        restLength = 1
      }

      const rest = new StaveNote({
        keys: ["b/4"],
        duration: restDuration,
      })
      notes.push(rest)
      i += restLength
    }
  }

  const beams: Beam[] = []
  for (const group of beamGroups) {
    if (group.length >= 2) {
      beams.push(new Beam(group))
    }
  }

  return { notes, beams }
}

export function NotationRenderer({ bars, currentBar, currentBeat, beatFraction }: NotationRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 200 })

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: Math.max(300, rect.width),
          height: 140,
        })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return

    containerRef.current.innerHTML = ""

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG)
    renderer.resize(dimensions.width, dimensions.height)
    const context = renderer.getContext()
    context.setFont("serif", 10)

    const staveWidth = (dimensions.width - 40) / Math.min(bars.length, 4)
    const staveY = 25

    bars.slice(0, 4).forEach((bar, index) => {
      const staveX = 20 + index * staveWidth
      const stave = new Stave(staveX, staveY, staveWidth - 10)

      if (index === 0) {
        stave.addClef("percussion")
        stave.addTimeSignature("4/4")
      }

      stave.setContext(context).draw()

      try {
        const { notes, beams } = barToVexNotes(bar)

        if (notes.length > 0) {
          const voice = new Voice({ numBeats: 4, beatValue: 4 })
          voice.setStrict(false)
          voice.addTickables(notes)

          new Formatter().joinVoices([voice]).format([voice], staveWidth - 50)
          voice.draw(context, stave)

          beams.forEach((beam) => beam.setContext(context).draw())
        }
      } catch (e) {
        console.error("VexFlow render error:", e)
      }
    })

    // Style the SVG with warm cream color for notation
    const svg = containerRef.current.querySelector("svg")
    if (svg) {
      svg.style.backgroundColor = "transparent"
      const notationColor = "#e8dcc8" // Warm cream/parchment color
      const paths = svg.querySelectorAll("path, line, rect")
      paths.forEach((el) => {
        if (el instanceof SVGElement) {
          el.style.stroke = notationColor
          el.style.fill = notationColor
        }
      })
      const texts = svg.querySelectorAll("text")
      texts.forEach((el) => {
        el.style.fill = notationColor
        el.style.fontFamily = "serif"
      })
    }
  }, [bars, dimensions])

  // Calculate playhead position
  const getPlayheadPosition = () => {
    if (bars.length === 0) return null

    const firstBarIndex = bars[0].barIndex
    const relativeBar = currentBar - firstBarIndex

    if (relativeBar < 0 || relativeBar >= 4) return null

    const staveWidth = (dimensions.width - 40) / Math.min(bars.length, 4)
    const noteAreaStart = 70
    const noteAreaWidth = staveWidth - 60

    const barX = 20 + relativeBar * staveWidth
    const beatProgress = currentBeat + beatFraction
    const progressInBar = beatProgress / 4

    const xOffset = relativeBar === 0 ? noteAreaStart : 30
    const availableWidth = relativeBar === 0 ? noteAreaWidth : staveWidth - 40

    return barX + xOffset + progressInBar * availableWidth
  }

  const playheadX = getPlayheadPosition()

  return (
    <div className="relative w-full">
      {/* Notation container */}
      <div ref={containerRef} className="w-full" />

      {/* Playhead with glow effect */}
      {playheadX !== null && (
        <>
          {/* Glow */}
          <div
            className="absolute top-0 w-4 pointer-events-none"
            style={{
              height: dimensions.height,
              transform: `translateX(${playheadX - 8}px)`,
              background: "radial-gradient(ellipse at center, rgba(245,158,11,0.3) 0%, transparent 70%)",
            }}
          />
          {/* Line */}
          <div
            className={cn(
              "absolute top-0 w-0.5 pointer-events-none",
              "bg-gradient-to-b from-primary via-primary-glow to-primary",
              "shadow-[0_0_8px_2px_rgba(245,158,11,0.5)]"
            )}
            style={{
              height: dimensions.height,
              transform: `translateX(${playheadX}px)`,
            }}
          />
        </>
      )}
    </div>
  )
}
