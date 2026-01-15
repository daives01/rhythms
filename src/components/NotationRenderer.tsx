// NotationRenderer - Proper music notation using VexFlow 5

import { useEffect, useRef, useState } from "react"
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam, RenderContext } from "vexflow"
import type { RuntimeBar } from "@/types"
import { cn } from "@/lib/utils"
import { transportEngine } from "@/engines/TransportEngine"

interface NotationRendererProps {
  bars: RuntimeBar[]
  currentBar: number
  currentBeat: number
  beatFraction: number
}

// Helper to check if an onset should be highlighted (was recently hit)
function shouldHighlightOnset(onset: any, currentTimeSec: number): boolean {
  if (!onset.hit) return false

  // Show gold for 200ms after hitting
  const timeSinceHit = currentTimeSec - onset.timeSec
  return timeSinceHit >= 0 && timeSinceHit <= 0.2
}

// Convert a bar's onsets into a 16-slot boolean grid and track onset data
function barToGrid(bar: RuntimeBar): {
  grid: boolean[]
  slotToOnset: Map<number, typeof bar.onsets[0]>
} {
  const grid = new Array(16).fill(false)
  const slotToOnset = new Map<number, typeof bar.onsets[0]>()

  for (const onset of bar.onsets) {
    const slot = onset.beatIndex * 4 + onset.n
    grid[slot] = true
    slotToOnset.set(slot, onset)
  }
  return { grid, slotToOnset }
}

// Process one beat (4 slots) and return notes/rests for that beat
// Merges consecutive rests and extends notes through following rests
function processBeat(
  grid: boolean[],
  beatStart: number,
  slotToOnset: Map<number, any>
): { note: StaveNote; onset: any | null }[] {
  const result: { note: StaveNote; onset: any | null }[] = []
  const slots = grid.slice(beatStart, beatStart + 4)

  let i = 0
  while (i < 4) {
    if (slots[i]) {
      // Note at position i - find how many rests follow (until next note or end of beat)
      let restCount = 0
      while (i + 1 + restCount < 4 && !slots[i + 1 + restCount]) {
        restCount++
      }

      // Determine note duration based on position and available space
      let note: StaveNote
      const onsetSlot = beatStart + i
      const onset = slotToOnset.get(onsetSlot) || null

      if (i === 0 && restCount === 3) {
        // Full beat available - quarter note
        note = new StaveNote({ keys: ["b/4"], duration: "q", stemDirection: 1 })
        i += 4
      } else if (i % 2 === 0 && restCount >= 1) {
        // On even position (beat or half-beat), at least one rest follows - 8th note
        note = new StaveNote({ keys: ["b/4"], duration: "8", stemDirection: 1 })
        i += 2
      } else {
        // 16th note (odd position or no following rest)
        note = new StaveNote({ keys: ["b/4"], duration: "16", stemDirection: 1 })
        i += 1
      }

      result.push({ note, onset })
    } else {
      // Rest at position i - count consecutive rests
      let restCount = 1
      while (i + restCount < 4 && !slots[i + restCount]) {
        restCount++
      }

      // Determine rest duration respecting beat boundaries
      let note: StaveNote

      if (i === 0 && restCount === 4) {
        // Full beat of rest - quarter rest
        note = new StaveNote({ keys: ["b/4"], duration: "qr" })
        i += 4
      } else if (i % 2 === 0 && restCount >= 2) {
        // On even position with 2+ rests - 8th rest
        note = new StaveNote({ keys: ["b/4"], duration: "8r" })
        i += 2
      } else {
        // 16th rest
        note = new StaveNote({ keys: ["b/4"], duration: "16r" })
        i += 1
      }

      result.push({ note, onset: null }) // Rests don't have onsets
    }
  }

  return result
}

// Convert full bar grid to VexFlow notes
function gridToVexNotes(
  grid: boolean[],
  slotToOnset: Map<number, any>
): {
  notes: StaveNote[]
  beamGroups: StaveNote[][]
  noteToOnset: Map<StaveNote, any>
} {
  const allNotes: StaveNote[] = []
  const beamGroups: StaveNote[][] = []
  const noteToOnset = new Map<StaveNote, any>()

  // Process each beat
  for (let beat = 0; beat < 4; beat++) {
    const beatNotes = processBeat(grid, beat * 4, slotToOnset)

    for (const { note, onset } of beatNotes) {
      allNotes.push(note)
      if (onset) {
        noteToOnset.set(note, onset)
      }
    }

    // Collect beamable notes (non-rests) for this beat
    const beamable = beatNotes
      .filter(({ note: n }) => {
        if (n.isRest()) return false
        const dur = n.getDuration()
        return dur === "16" || dur === "8"
      })
      .map(({ note }) => note)
    beamGroups.push(beamable)
  }

  return { notes: allNotes, beamGroups, noteToOnset }
}

// Render a single bar
function renderBar(
  ctx: RenderContext,
  bar: RuntimeBar,
  x: number,
  y: number,
  width: number,
  isFirst: boolean,
  currentTimeSec: number
): Map<any, any> {
  const stave = new Stave(x, y, width)

  if (isFirst) {
    stave.addClef("percussion")
    stave.addTimeSignature("4/4")
  }

  stave.setContext(ctx).draw()

  const { grid, slotToOnset } = barToGrid(bar)
  const { notes, beamGroups, noteToOnset } = gridToVexNotes(grid, slotToOnset)

  if (notes.length === 0) return new Map()

  try {
    const voice = new Voice({ numBeats: 4, beatValue: 4 })
    voice.setStrict(false)
    voice.addTickables(notes)

    // Create beams BEFORE formatting/drawing so VexFlow knows to suppress flags
    const beams: Beam[] = []
    for (const group of beamGroups) {
      if (group.length >= 2) {
        try {
          beams.push(new Beam(group))
        } catch {
          // Beaming can fail for various reasons, ignore
        }
      }
    }

    new Formatter().joinVoices([voice]).format([voice], width - (isFirst ? 90 : 40))
    voice.draw(ctx, stave)

    // Draw beams after voice
    for (const beam of beams) {
      beam.setContext(ctx).draw()
    }

    // Return note to onset mapping for later highlighting
    return noteToOnset
  } catch (e) {
    console.error("VexFlow render error:", e)
    return new Map()
  }
}

export function NotationRenderer({ bars, currentBar, currentBeat, beatFraction }: NotationRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 150 })

  // Scroll position based on time
  const scrollPosition = useRef(0)

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: Math.max(400, rect.width),
          height: 150,
        })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  // Calculate bar width for consistent sizing
  const barWidth = (dimensions.width - 20) / 4 // Width of one bar in visible area

  useEffect(() => {
    if (!svgRef.current || bars.length === 0) return

    svgRef.current.innerHTML = ""

    // Render all bars in buffer (up to 8) on a wide canvas
    const numBars = bars.length
    const totalWidth = barWidth * numBars + 20

    const renderer = new Renderer(svgRef.current, Renderer.Backends.SVG)
    renderer.resize(totalWidth, dimensions.height)
    const ctx = renderer.getContext()

    // Get current time for note highlighting
    const currentTimeSec = transportEngine.now()

    // Collect all note-to-onset mappings
    const allNoteToOnset: Map<any, any>[] = []

    bars.forEach((bar, index) => {
      const isFirst = bar.barIndex === 0 // Only show clef on actual first bar
      const barX = 10 + index * barWidth
      const barW = barWidth - 2

      const noteToOnset = renderBar(ctx, bar, barX, 30, barW, isFirst, currentTimeSec)
      allNoteToOnset.push(noteToOnset)
    })

    // Style SVG for dark theme
    const svg = svgRef.current.querySelector("svg")
    if (svg) {
      svg.style.overflow = "visible"
      const color = "#e8dcc8"

      svg.querySelectorAll("*").forEach((el) => {
        const elem = el as SVGElement
        if (elem.hasAttribute("stroke") && elem.getAttribute("stroke") !== "none") {
          elem.setAttribute("stroke", color)
        }
        if (elem.hasAttribute("fill") && elem.getAttribute("fill") !== "none") {
          elem.setAttribute("fill", color)
        }
        if (elem.style) {
          if (elem.style.stroke && elem.style.stroke !== "none") elem.style.stroke = color
          if (elem.style.fill && elem.style.fill !== "none") elem.style.fill = color
        }
      })

      svg.querySelectorAll("text").forEach((el) => {
        el.setAttribute("fill", color)
        el.style.fill = color
      })

      svg.querySelectorAll("path").forEach((el) => {
        el.setAttribute("fill", color)
        el.setAttribute("stroke", color)
      })

      svg.querySelectorAll("line").forEach((el) => {
        el.setAttribute("stroke", color)
      })

      svg.querySelectorAll("rect").forEach((el) => {
        const fill = el.getAttribute("fill")
        if (fill !== "none") el.setAttribute("fill", color)
      })

      // NOW apply gold highlighting AFTER dark theme (so it doesn't get overwritten)
      const goldColor = "#f59e0b"

      // Iterate through all SVG elements and check if they should be gold
      for (const noteToOnset of allNoteToOnset) {
        noteToOnset.forEach((onset, note) => {
          if (shouldHighlightOnset(onset, currentTimeSec)) {
            // Find the SVG elements for this note and color them gold
            try {
              const elem = note.getSVGElement()
              if (elem) {
                // Color all paths within this note element
                elem.querySelectorAll("path").forEach((path: SVGElement) => {
                  path.setAttribute("fill", goldColor)
                  path.setAttribute("stroke", goldColor)
                })
                elem.querySelectorAll("ellipse").forEach((ellipse: SVGElement) => {
                  ellipse.setAttribute("fill", goldColor)
                  ellipse.setAttribute("stroke", goldColor)
                })
                elem.querySelectorAll("rect").forEach((rect: SVGElement) => {
                  rect.setAttribute("fill", goldColor)
                })
              }
            } catch (e) {
              // Ignore errors accessing SVG elements
            }
          }
        })
      }
    }
  }, [bars, dimensions, barWidth, currentBar, currentBeat, beatFraction])

  // Simple smooth scroll based on current bar progress
  if (bars.length > 0) {
    const firstBarIndex = bars[0].barIndex
    const relativeBar = currentBar - firstBarIndex
    const barProgress = (currentBeat + beatFraction) / 4
    const totalProgress = relativeBar + barProgress

    // Scroll to keep notation centered, smooth continuous motion
    const targetScroll = totalProgress * barWidth - dimensions.width * 0.15
    scrollPosition.current = targetScroll
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: dimensions.height }}
    >
      {/* Scrolling notation container */}
      <div
        ref={svgRef}
        className="absolute top-0 left-0"
        style={{
          transform: `translateX(${-scrollPosition.current}px)`,
          transition: "none",
        }}
      />

      {/* Removed playhead - notes now highlight in gold when active */}
    </div>
  )
}
